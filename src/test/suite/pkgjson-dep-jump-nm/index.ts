import { exec as exec_ } from 'child_process';
import glob from 'glob';
import Mocha from 'mocha';
import path from 'path';
import { promisify } from 'util';

import { getWorkSpacePath } from '../util';

const exec = promisify(exec_);

export async function run(): Promise<void> {
  const WorkspacePath = getWorkSpacePath();

  // await exec('npm i', { cwd: WorkspacePath });

  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true
  });

  const testsRoot = path.resolve(__dirname);

  return new Promise((c, e) => {
    glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
      if (err) {
        return e(err);
      }

      // Add files to the test suite
      files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

      try {
        mocha.timeout('20s');
        // Run the mocha test
        mocha.run(failures => {
          if (failures > 0) {
            e(new Error(`${failures} tests failed.`));
          } else {
            c();
          }
        });
      } catch (err) {
        console.error(err);
        e(err);
      }
    });
  });
}
