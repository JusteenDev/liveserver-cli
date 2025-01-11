#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import http from 'http';
import open from 'open';
import chalk from 'chalk';
import express from 'express';
import livereload from 'livereload';
import connectLivereload from 'connect-livereload';
import { Command } from 'commander';
import { exec } from 'child_process';

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json')));
const version = packageJson.version || 'unknown';  // Default to 'unknown' if version is not found

const app = express();
const program = new Command();

program
  .argument('[html-file]', 'Path to a specific HTML file')
  .option('--tool', 'Use the default tool to serve the client folder')
  .option('--port <port>', 'Specify the port to run the server on', '3000')
  .description('Start a live server to serve HTML files')
  .action((htmlFile) => {
    const port = program.opts().port;
    
    if (program.opts().tool) {
      exec('npm root -g', (error, stdout, stderr) => {
        if (error || stderr) {
          console.error(error || stderr);
          return;
        }
        
        const globalDir = stdout.trim();
        const clientDir = path.resolve(globalDir, 'liveserver-cli', 'client');
        const jsonFilePath = path.resolve(globalDir, 'liveserver-cli', 'package.json');
        
        // Read and parse the package.json inside the global 'liveserver-cli' directory
        try {
          const globalPackageJson = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
          // console.log('Global liveserver-cli package.json:', globalPackageJson);
        } catch (err) {
          console.error('Error reading global liveserver-cli package.json:', err);
        }

        if (fs.existsSync(clientDir)) {
          const liveReloadServer = livereload.createServer();
          liveReloadServer.watch(clientDir);
          app.use(connectLivereload());
          app.use(express.static(clientDir));
          
          app.get('*', (req, res) => {
            res.sendFile(path.join(clientDir, 'index.html'));
          });

          startServer(clientDir, port);
        } else {
          console.error(`The 'client' folder does not exist in the global directory.`);
          process.exit(1);
        }
      });
      
    } else if (htmlFile) {
      const resolvedHtmlFile = path.resolve(htmlFile);
      if (fs.existsSync(resolvedHtmlFile) && path.extname(resolvedHtmlFile) === '.html') {
        app.get('/live', (req, res) => {
          res.sendFile(resolvedHtmlFile);
        });

        startServer(resolvedHtmlFile, port);
      } else {
        console.error(`The HTML file "${htmlFile}" does not exist or is not a valid HTML file.`);
        process.exit(1);
      }
    } else {
      console.error('You need to either use --tool or specify an HTML file.');
      process.exit(1);
    }
  });

function startServer(directory, port) {
  const server = http.createServer(app);
  
  server.listen(port, () => {
    console.log(chalk.blue(`\nLiveserver v${version}\n`))
    console.log(chalk.green("\tLocal: "), chalk.yellow.underline(`http://localhost:${port}`));
  });
}

program.parse(process.argv);