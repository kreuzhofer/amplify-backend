import { after, before, beforeEach, describe, it, mock } from 'node:test';
import {
  attachUnhandledExceptionListeners,
  generateCommandFailureHandler,
} from './error_handler.js';
import { Argv } from 'yargs';
import { COLOR, Printer } from '@aws-amplify/cli-core';
import assert from 'node:assert';
import { InvalidCredentialError } from './error/credential_error.js';

void describe('generateCommandFailureHandler', () => {
  const mockPrint = mock.method(Printer, 'print');

  const mockShowHelp = mock.fn();
  const mockExit = mock.fn();

  const parser = {
    showHelp: mockShowHelp,
    exit: mockExit,
  } as unknown as Argv;

  beforeEach(() => {
    mockPrint.mock.resetCalls();
    mockShowHelp.mock.resetCalls();
    mockExit.mock.resetCalls();
  });

  void it('prints specified message with undefined error', () => {
    const someMsg = 'some msg';
    // undefined error is encountered with --help option.
    generateCommandFailureHandler(parser)(
      someMsg,
      undefined as unknown as Error
    );
    assert.equal(mockPrint.mock.callCount(), 1);
    assert.equal(mockShowHelp.mock.callCount(), 1);
    assert.equal(mockExit.mock.callCount(), 1);
    assert.deepStrictEqual(mockPrint.mock.calls[0].arguments, [
      someMsg,
      COLOR.RED,
    ]);
  });

  void it('prints message from error object', () => {
    const errMsg = 'some error msg';
    generateCommandFailureHandler(parser)('', new Error(errMsg));
    assert.equal(mockPrint.mock.callCount(), 1);
    assert.equal(mockShowHelp.mock.callCount(), 1);
    assert.equal(mockExit.mock.callCount(), 1);
    assert.match(mockPrint.mock.calls[0].arguments[0], new RegExp(errMsg));
    assert.equal(mockPrint.mock.calls[0].arguments[1], COLOR.RED);
  });

  void it('handles a prompt force close error', () => {
    generateCommandFailureHandler(parser)(
      '',
      new Error('User force closed the prompt')
    );
    assert.equal(mockExit.mock.callCount(), 1);
    assert.equal(mockPrint.mock.callCount(), 0);
  });

  void it('handles a profile error', () => {
    const errMsg = 'some profile error';
    generateCommandFailureHandler(parser)(
      '',
      new InvalidCredentialError(errMsg)
    );
    assert.equal(mockExit.mock.callCount(), 1);
    assert.equal(mockPrint.mock.callCount(), 1);
    assert.match(mockPrint.mock.calls[0].arguments[0], new RegExp(errMsg));
    assert.equal(mockPrint.mock.calls[0].arguments[1], COLOR.RED);
  });
});

void describe('attachUnhandledExceptionListeners', { concurrency: 1 }, () => {
  const mockPrint = mock.method(Printer, 'print');

  before(() => {
    attachUnhandledExceptionListeners();
  });

  beforeEach(() => {
    mockPrint.mock.resetCalls();
  });

  after(() => {
    // remove the exception listeners that were added during setup
    process.listeners('unhandledRejection').pop();
    process.listeners('uncaughtException').pop();
  });
  void it('handles rejected errors', () => {
    process.listeners('unhandledRejection').at(-1)?.(
      new Error('test error'),
      Promise.resolve()
    );
    assert.ok(
      mockPrint.mock.calls.findIndex((call) =>
        call.arguments[0].includes('test error')
      ) >= 0
    );
    expectProcessExitCode1AndReset();
  });

  void it('handles rejected strings', () => {
    process.listeners('unhandledRejection').at(-1)?.(
      'test error',
      Promise.resolve()
    );
    assert.ok(
      mockPrint.mock.calls.findIndex((call) =>
        call.arguments[0].includes('test error')
      ) >= 0
    );
    expectProcessExitCode1AndReset();
  });

  void it('handles rejected symbols of other types', () => {
    process.listeners('unhandledRejection').at(-1)?.(
      { something: 'weird' },
      Promise.resolve()
    );
    assert.ok(
      mockPrint.mock.calls.findIndex((call) =>
        call.arguments[0].includes(
          'Error: Unhandled rejection of type [object]'
        )
      ) >= 0
    );
    expectProcessExitCode1AndReset();
  });

  void it('handles uncaught errors', () => {
    process.listeners('uncaughtException').at(-1)?.(
      new Error('test error'),
      'uncaughtException'
    );
    assert.ok(
      mockPrint.mock.calls.findIndex((call) =>
        call.arguments[0].includes('test error')
      ) >= 0
    );
    expectProcessExitCode1AndReset();
  });

  void it('does nothing when called multiple times', () => {
    // note the first call happened in the before() setup

    const unhandledRejectionListenerCount =
      process.listenerCount('unhandledRejection');
    const uncaughtExceptionListenerCount =
      process.listenerCount('uncaughtException');

    attachUnhandledExceptionListeners();
    attachUnhandledExceptionListeners();

    assert.equal(
      process.listenerCount('unhandledRejection'),
      unhandledRejectionListenerCount
    );
    assert.equal(
      process.listenerCount('uncaughtException'),
      uncaughtExceptionListenerCount
    );
  });
});

const expectProcessExitCode1AndReset = () => {
  assert.equal(process.exitCode, 1);
  process.exitCode = 0;
};