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
  .description('Start a live server to serve HTML files')
  .action((htmlFile) => {
    const port = program.opts().port;

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

    if (program.opts().tool) {
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
            const liveReloadServer = livereload.createServer();
            liveReloadServer.watch(clientDir);

            chokidar.watch(clientDir).on('change', (filePath) => {
              console.log(chalk.green(`[INFO] File changed: ${filePath}`));
              liveReloadServer.refresh(filePath);
            });

            app.use(connectLivereload());
            app.use(express.static(clientDir));

            app.get('*', (req, res) => {
              res.sendFile(path.join(clientDir, 'index.html'));
            });

            startServer(port, version);
          } else {
            console.error(`The 'client' folder does not exist in the global directory.`);
            process.exit(1);
          }
        });
      });
    } else if (htmlFile) {
      // Serve a specific HTML file with live reload functionality
      getVersion((version) => {
        const resolvedHtmlFile = path.resolve(htmlFile);

        if (fs.existsSync(resolvedHtmlFile) && path.extname(resolvedHtmlFile) === '.html') {
          const liveReloadServer = livereload.createServer();

          liveReloadServer.watch(resolvedHtmlFile);

          // Watch for changes to the HTML file and log them
          chokidar.watch(resolvedHtmlFile).on('change', (filePath) => {
            console.log(chalk.green(`[INFO] file changed: ${filePath}`));
            liveReloadServer.refresh(filePath);
          });

          app.use(connectLivereload());

          app.get('/live', (req, res) => {
            res.sendFile(resolvedHtmlFile);
          });

          startServer(port, version);
        } else {
          console.error(`The HTML file "${htmlFile}" does not exist or is not a valid HTML file.`);
          process.exit(1);
        }
      });
    } else {
      console.error('You need to either use --tool or specify an HTML file.');
      process.exit(1);
    }
  });

function startServer(port, version = 'unknown') {
  const server = http.createServer(app);

  server.listen(port, () => {
    console.log(chalk.blue(`\nLiveserver v${version}\n`));
    console.log(chalk.green("\tLocal Tool: "), chalk.yellow.underline(`http://localhost:${port}`));
    console.log(chalk.green("\tLocal Html: "), chalk.yellow.underline(`http://localhost:${port}/live`));
  });
}

program.parse(process.argv);