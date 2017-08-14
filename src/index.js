const path = require('path');
const throat = require("throat");
const execa = require("execa");

const eslintBin = path.resolve("node_modules", ".bin", "eslint");

const toTestResult = ({testPath, status, start, end, failureMessage}) => {
  return {
    console: null,
    failureMessage,
    numFailingTests: status === 'failed' ? 1 : 0,
    numPassingTests: status === 'passed' ? 1 : 0,
    numPendingTests: status === 'pending' ? 1 : 0,
    perfStats: {
      end,
      start,
    },
    skipped: false,
    snapshot: {
      added: 0,
      fileDeleted: false,
      matched: 0,
      unchecked: 0,
      unmatched: 0,
      updated: 0,
    },
    sourceMaps: {},
    testExecError: null,
    testFilePath: testPath,
    testResults: [
      {
        ancestorTitles: [],
        duration: end - start,
        failureMessages: failureMessage ? [failureMessage] : [],
        fullName: testPath,
        numPassingAsserts: status === 'passed' ? 1 : 0,
        status,
        title: testPath,
      }
    ],
  };
}

class ESLintRunner {
  constructor(globalConfig) {
    this._globalConfig = globalConfig;
  }

  async runTests(tests, watcher, onStart, onResult, onFailure, options) {
    const mutex = throat(this._globalConfig.maxWorkers);
    return Promise.all(
      tests.map(test =>
        mutex(async () => {
          if (watcher.isInterrupted()) {
            throw new CancelRun();
          }

          await onStart(test);
          return this._runTest(test.path)
            .then(result => onResult(test, result))
            .catch(error => onFailure(test, error));
        })
      )
    );
  }

  async _runTest(testPath) {
    const start = +new Date();
    return execa(eslintBin, ["--color", testPath])
      .then(({ stdout }) => {
        return toTestResult({
          testPath,
          status: 'passed',
          start,
          end: +new Date(),
        });
      })
      .catch(({ stdout }) => {
        return toTestResult({
          testPath,
          status: 'failed',
          start,
          end: +new Date(),
          failureMessage: stdout,
        });
      });
  }
}


class CancelRun extends Error {
  constructor(message) {
    super(message);
    this.name = 'CancelRun';
  }
}

module.exports = ESLintRunner;