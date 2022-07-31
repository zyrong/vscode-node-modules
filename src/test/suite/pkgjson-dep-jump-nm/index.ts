import path from 'path';
import Mocha from 'mocha';
import glob from 'glob';
import { exec as exec_, ExecOptions, execFile } from 'child_process';
import { promisify } from 'util';
const exec = promisify(exec_);
import { workspace } from 'vscode';
import { getWorkSpacePath } from '../util';


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
