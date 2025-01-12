#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import http from 'http';
import chalk from 'chalk';
import express from 'express';
import livereload from 'livereload';
import connectLivereload from 'connect-livereload';
import { Command } from 'commander';
import { exec } from 'child_process';
import chokidar from 'chokidar';

const app = express();
const program = new Command();

program
  .argument('[html-file]', 'Path to a specific HTML file')
  .option('--tool', 'Use the default tool to serve the client folder')
  .option('--port <port>', 'Specify the port to run the server on', '3000')
  .option('--livereload <lr-port>', 'Specify the LiveReload port', '35729')
  .description('Start a live server to serve HTML files')
  .action((htmlFile) => {
    const options = program.opts();
    const port = options.port;
    const lrPort = options.livereload;

    // Helper function to get the version from package.json
    const getVersion = (callback) => {
      exec('npm root -g', (error, stdout, stderr) => {
        if (error || stderr) {
          console.error(error || stderr);
          callback(null);
          return;
        }

        const globalDir = stdout.trim();
        const jsonFilePath = path.resolve(globalDir, 'liveserver-cli', 'package.json');

        try {
          const globalPackageJson = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
          callback(globalPackageJson.version || 'unknown');
        } catch (err) {
          console.error('Error reading global liveserver-cli package.json:', err);
          callback(null);
        }
      });
    };

    const startLiveServer = (baseDir, fileToServe) => {
      const liveReloadServer = livereload.createServer({ port: lrPort });
      liveReloadServer.watch(baseDir);

      chokidar.watch(baseDir).on('change', (filePath) => {
        console.log(chalk.green(`[INFO] File changed: ${filePath}`));
        liveReloadServer.refresh(filePath);
      });

      app.use(connectLivereload());
      app.use(express.static(baseDir));

      app.get('*', (req, res) => {
        res.sendFile(fileToServe || path.join(baseDir, 'index.html'));
      });

      getVersion((version) => startServer(port, lrPort, version));
    };

    if (options.tool) {
      // Serve files from the global `client` folder when `--tool` is used
      getVersion((version) => {
        exec('npm root -g', (error, stdout, stderr) => {
          if (error || stderr) {
            console.error(error || stderr);
            return;
          }

          const globalDir = stdout.trim();
          const clientDir = path.resolve(globalDir, 'liveserver-cli', 'client');

          if (fs.existsSync(clientDir)) {
            startLiveServer(clientDir);
          } else {
            console.error(`The 'client' folder does not exist in the global directory.`);
            process.exit(1);
          }
        });
      });
    } else if (htmlFile) {
      // Serve a specific HTML file with live reload functionality
      const resolvedHtmlFile = path.resolve(htmlFile);
      const htmlDir = path.dirname(resolvedHtmlFile);

      if (fs.existsSync(resolvedHtmlFile) && path.extname(resolvedHtmlFile) === '.html') {
        startLiveServer(htmlDir, resolvedHtmlFile);
      } else {
        console.error(`The HTML file "${htmlFile}" does not exist or is not a valid HTML file.`);
        process.exit(1);
      }
    } else {
      console.error('You need to either use --tool or specify an HTML file.');
      process.exit(1);
    }
  });

function startServer(port, lrPort, version = 'unknown') {
  const server = http.createServer(app);

  server.listen(port, () => {
    console.log(chalk.blue(`\nLiveserver v${version}\n`));
    console.log(chalk.green("   Local Tool: "), chalk.yellow.underline(`http://localhost:${port}`));
    console.log(chalk.green("   Local Html: "), chalk.yellow.underline(`http://localhost:${port}/live`));
    console.log(chalk.green("   LiveReload: "), chalk.yellow.underline(`http://localhost:${lrPort}`));
  });
}

program.parse(process.argv);