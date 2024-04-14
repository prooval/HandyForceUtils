// Path: /routes/deploymentRoutes.js
const express = require('express');
const router = express.Router();
const knex = require('../db/knex'); // Ensure Knex configuration is correctly set up

router.get('/api/deployments', async (req, res) => {
    try {
        const rawData = await knex('Deployments')
            .join('ArtifactPullRequest', 'Deployments.artifact_id', '=', 'ArtifactPullRequest.artifact_id')
            .join('Artifacts', 'Artifacts.artifact_id', '=', 'Deployments.artifact_id')
            .join('PullRequests', 'PullRequests.pullrequest_id', '=', 'ArtifactPullRequest.pullrequest_id')
            .select(
                'Deployments.*', 
                'Artifacts.artifact_name',
                'PullRequests.pullrequest_id',
                'PullRequests.src_branch_name',
                'PullRequests.dest_branch_name',
                'PullRequests.commit_start_hash',
                'PullRequests.commit_end_hash',
                'PullRequests.created_at as pr_created_at',
                'PullRequests.merged_at'
            );

        const transformedData = rawData.reduce((acc, row) => {
            if (!acc[row.deployment_id]) {
                acc[row.deployment_id] = {
                    deployment: {
                        deployment_id: row.deployment_id,
                        pipeline_id: row.pipeline_id,
                        artifact_id: row.artifact_id,
                        status: row.status,
                        result: row.result,
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                        deployed_at: row.deployed_at
                    },
                    artifact: {
                        artifact_id: row.artifact_id,
                        artifact_name: row.artifact_name
                    },
                    pull_requests: []
                };
            }

            acc[row.deployment_id].pull_requests.push({
                pullrequest_id: row.pullrequest_id,
                src_branch_name: row.src_branch_name,
                dest_branch_name: row.dest_branch_name,
                commit_start_hash: row.commit_start_hash,
                commit_end_hash: row.commit_end_hash,
                created_at: row.pr_created_at,
                merged_at: row.merged_at
            });

            return acc;
        }, {});

        res.json(Object.values(transformedData));
    } catch (error) {
        console.error('Error fetching deployments:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;


const express = require('express');
const app = express();
const port = 3000; // You can choose any port
const archiver = require('archiver');

// Endpoint to download files as a zip
app.get('/download', (req, res) => {
    // Define the path to the directory containing the files you want to zip
    const directoryPath = 'path/to/your/files';

    // Set the name for the downloaded zip file
    const zipFileName = 'downloadedFiles.zip';

    // Set headers to inform the browser about the download
    res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-disposition': `attachment; filename=${zipFileName}`
    });

    const archive = archiver('zip', { zlib: { level: 9 }}); // Set the compression level
    archive.on('error', function(err) {
        throw err;
    });

    // Pipe archive data to the response
    archive.pipe(res);

    // Append files from a directory
    // Alternatively, you can append individual files via `archive.file('path', { name: 'filename' })`
    archive.directory(directoryPath, false);

    // Finalize the archive (this is where the zip is actually created and sent)
    archive.finalize();
});

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});

const express = require('express');
const cors = require('cors');
const app = express();

// Configure CORS
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || /^https?:\/\/(?:.+\.)?ftbco\.ftn\.com(?::\d{1,5})?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

// Enable CORS with the specified options
app.use(cors(corsOptions));

// Your routes go here

const port = process.env.PORT || 3000; // Replace 3000 with your actual port number
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

const express = require('express');
const cors = require('cors');
const app = express();

// Configure CORS
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || /^https?:\/\/(?:.+\.)?ftbco\.ftn\.com(?::\d{1,5})?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

// Enable CORS with the specified options
app.use(cors(corsOptions));

// Your routes go here

const port = process.env.PORT || 3000; // Replace 3000 with your actual port number
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

app.get('/today-log', (req, res) => {
  const today = new Date();
  const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const logFileName = `app-${dateString}.log`;
  const logFilePath = path.join(__dirname, 'logs', logFileName);

  fs.readFile(logFilePath, 'utf-8', (err, data) => {
      if (err) {
          console.error("Failed to read log file:", err);
          return res.status(500).send("Failed to load today's log file");
      }
      res.type('text/plain').send(data);
  });
});

/ server.js
const express = require('express');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

app.get('/download', (req, res) => {
    const folderPath = req.query.folderPath;
    const filePattern = req.query.filePattern;
    
    // Ensure the folder path and file pattern are provided
    if (!folderPath || !filePattern) {
        return res.status(400).send('Missing folder path or file pattern');
    }

    // Create a zip archive using archiver
    const archive = archiver('zip', {
        zlib: { level: 9 } // Set the compression level
    });

    // Handle archive stream errors
    archive.on('error', (err) => {
        throw err;
    });

    // Pipe the archive data to the response
    archive.pipe(res);

    // Set the headers for downloading
    res.attachment('download.zip');

    // Read the directory and add matching files to the archive
    fs.readdir(folderPath, (err, files) => {
        if (err) {
            return res.status(500).send('Failed to read directory');
        }

        files.forEach(file => {
            if (file.match(filePattern)) {
                const filePath = path.join(folderPath, file);
                archive.file(filePath, { name: file });
            }
        });

        // Finalize the archive (this is where the zip is actually created)
        archive.finalize();
    });
});

<div x-data="{ deploymentId: '0Af1n00000BZtvjCAD' }"> <!-- Example ID -->
    <a x-bind:href="'https://your-instance.lightning.force.com/lightning/setup/DeployStatus/page?address=%2Fchangemgmt%2FmonitorDeploymentsDetails.apexp%3FasyncId=' + deploymentId"
       target="_blank">Check Deployment Status</a>
</div>
