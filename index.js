#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import http from 'http';
import open from 'open';
import express from 'express';
import livereload from 'livereload';
import connectLivereload from 'connect-livereload';
import { Command } from 'commander';
import { exec } from 'child_process';  // Import exec from child_process

const app = express();
const program = new Command();

// Define the program and the available arguments
program
  .argument('[html-file]', 'Path to a specific HTML file')
  .option('--tool', 'Use the default tool to serve the client folder')
  .description('Start a live server to serve HTML files')
  .action((htmlFile) => {
    if (program.opts().tool) {
      // Get the global directory using npm root -g
      exec('npm root -g', (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
          return;
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          return;
        }

        // Resolve the global liveserver directory and client folder
        const globalDir = stdout.trim();
        const clientDir = path.resolve(globalDir, 'liveserver-cli', 'client'); // Assuming 'client' folder is inside liveserver package

        // Check if the 'client' folder exists
        if (fs.existsSync(clientDir)) {
          const liveReloadServer = livereload.createServer();
          liveReloadServer.watch(clientDir);
          app.use(connectLivereload());
          app.use(express.static(clientDir));  // Serve static files from the 'client' folder

          // Handle React SPA fallback routing (for client-side routing)
          app.get('*', (req, res) => {
            res.sendFile(path.join(clientDir, 'index.html'));
          });

          startServer(clientDir);
        } else {
          console.error(`The 'client' folder does not exist in the global directory.`);
          process.exit(1);
        }
      });
    } else if (htmlFile) {
      // If a specific HTML file is provided, serve it on the '/live' route
      const resolvedHtmlFile = path.resolve(htmlFile);
      if (fs.existsSync(resolvedHtmlFile) && path.extname(resolvedHtmlFile) === '.html') {
        app.get('/live', (req, res) => {
          res.sendFile(resolvedHtmlFile);
        });

        startServer(resolvedHtmlFile);
      } else {
        console.error(`The HTML file "${htmlFile}" does not exist or is not a valid HTML file.`);
        process.exit(1);
      }
    } else {
      console.error('You need to either use --tool or specify an HTML file.');
      process.exit(1);
    }
  });

// Function to start the server
function startServer(directory) {
  const server = http.createServer(app);
  const port = 3000;

  server.listen(port, () => {
    console.log(`Live server started at http://localhost:${port}`);
    open(`http://localhost:${port}`);
  });
}

// Parse the command-line arguments
program.parse(process.argv);a
a
