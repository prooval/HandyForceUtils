/**
 * your-project/
│
├── db/
│   ├── knex.js          # Setup and export your Knex configuration
│   ├── models/          # Directory for model files
│   │   ├── Artifacts.js
│   │   ├── Deployments.js
│   │   ├── DeploymentSteps.js
│   │   ├── Pipelines.js
│   │   └── PullRequests.js
│   └── index.js         # Optionally, to export all your db models for easy import
│
├── knexfile.js          # Knex configuration file
└── ...                  # Other project files (e.g., server setup, utilities, etc.)
 */

// db/knex.js
const knexConfig = require('../knexfile');
const knex = require('knex')(knexConfig.development); // Adjust environment as needed

module.exports = knex;
// db/models/Deployments.js
const knex = require('../knex'); // Import the configured Knex

const Deployments = {
  // CRUD methods as provided...
};

module.exports = Deployments;

// db/index.js
module.exports = {
    Artifacts: require('./models/Artifacts'),
    Deployments: require('./models/Deployments'),
    DeploymentSteps: require('./models/DeploymentSteps'),
    Pipelines: require('./models/Pipelines'),
    PullRequests: require('./models/PullRequests'),
  };

  const { Deployments, Artifacts } = require('./db');

async function createDeployment() {
  const newDeployment = await Deployments.create({ /* ... */ });
  console.log(newDeployment);
}

createDeployment();

// ---- 

const knex = require('./db/knex'); // Ensure this points to your configured Knex instance

async function createDeploymentWithSteps(deploymentData, stepsData, artifactId, artifactUpdateData) {
  try {
    // Start transaction
    await knex.transaction(async trx => {
      // Step 1: Create a deployment
      const [newDeployment] = await trx('deployments').insert(deploymentData).returning('*');
      console.log('New Deployment:', newDeployment);

      // Step 2: Create deployment steps
      // Assuming stepsData is an array of step objects
      const stepsWithDeploymentId = stepsData.map(step => ({ ...step, deployment_id: newDeployment.deployment_id }));
      const newSteps = await trx('deployment_steps').insert(stepsWithDeploymentId).returning('*');
      console.log('New Steps:', newSteps);

      // Step 3: Update an artifact record
      const [updatedArtifact] = await trx('artifacts').where({ artifact_id: artifactId }).update(artifactUpdateData, '*');
      console.log('Updated Artifact:', updatedArtifact);

      // If everything goes well, transaction is automatically committed
    });

    console.log('Deployment and steps created successfully, and artifact updated.');
  } catch (error) {
    // If any operation fails, transaction is automatically rolled back
    console.error('Transaction failed:', error.message);
    // Here, you can throw the error further if you want to handle it outside
    throw error;
  }
}

// Example usage
const deploymentData = { /* your deployment data */ };
const stepsData = [{ /* step 1 data */ }, { /* step 2 data */ }]; // and so on
const artifactId = 1; // example artifact ID
const artifactUpdateData = { /* your artifact update data */ };

createDeploymentWithSteps(deploymentData, stepsData, artifactId, artifactUpdateData)
  .then(() => console.log('Operation successful'))
  .catch(error => console.log('Operation failed:', error.message));

  const knex = require('./db/knex'); // Ensure this points to your configured Knex instance

  async function createDeploymentWithSteps(deploymentData, stepsData, artifactId, artifactUpdateData) {
    try {
      // Start transaction
      await knex.transaction(async trx => {
        // Step 1: Create a deployment
        const [newDeployment] = await trx('deployments').insert(deploymentData).returning('*');
        console.log('New Deployment:', newDeployment);
  
        // Step 2: Create deployment steps
        // Assuming stepsData is an array of step objects
        const stepsWithDeploymentId = stepsData.map(step => ({ ...step, deployment_id: newDeployment.deployment_id }));
        const newSteps = await trx('deployment_steps').insert(stepsWithDeploymentId).returning('*');
        console.log('New Steps:', newSteps);
  
        // Step 3: Update an artifact record
        const [updatedArtifact] = await trx('artifacts').where({ artifact_id: artifactId }).update(artifactUpdateData, '*');
        console.log('Updated Artifact:', updatedArtifact);
  
        // If everything goes well, transaction is automatically committed
      });
  
      console.log('Deployment and steps created successfully, and artifact updated.');
    } catch (error) {
      // If any operation fails, transaction is automatically rolled back
      console.error('Transaction failed:', error.message);
      // Here, you can throw the error further if you want to handle it outside
      throw error;
    }
  }
  
  // Example usage
  const deploymentData = { /* your deployment data */ };
  const stepsData = [{ /* step 1 data */ }, { /* step 2 data */ }]; // and so on
  const artifactId = 1; // example artifact ID
  const artifactUpdateData = { /* your artifact update data */ };
  
  createDeploymentWithSteps(deploymentData, stepsData, artifactId, artifactUpdateData)
    .then(() => console.log('Operation successful'))
    .catch(error => console.log('Operation failed:', error.message));
  
  createDeploymentWithSteps(deploymentData, stepsData, artifactId, artifactUpdateData)
    .then(() => console.log('Operation successful'))
    .catch(error => console.log('Operation failed:', error.message));

// ----- Locking mechanism ------  //

// Assuming this is in your Deployments model file (Deployments.js)

const knex = require('../knex'); // Import the configured Knex instance

const Deployments = {
  // Existing CRUD methods...

  async startNewDeployment({ pipeline_id, artifact_id }) {
    // Check if there's an ongoing deployment
    const ongoing = await knex('deployments').where({ deployment_status: 'In Progress' }).first();
    if (ongoing) {
      throw new Error('A deployment is already in progress.');
    }

    // If not, start a new deployment
    const [newDeployment] = await knex('deployments').insert({
      pipeline_id,
      artifact_id,
      deployment_status: 'New', // Initial status
      created_at: new Date()
    }).returning('*');

    return newDeployment;
  },

  async updateDeploymentStatus(deploymentId, deployment_status) {
    const [updatedDeployment] = await knex('deployments')
      .where({ deployment_id: deploymentId })
      .update({
        deployment_status,
        deployment_status,
        updated_at: new Date()
      }, '*');
    return updatedDeployment;
  }
};

const { Deployments } = require('./db/models/Deployments'); // Adjust path as needed

async function checkForNewlyMergedPRs() {
  try {
    // Attempt to start a new deployment
    const newDeployment = await Deployments.startNewDeployment({
      pipeline_id: /* your pipeline ID */,
      artifact_id: /* your artifact ID */
    });
    console.log("New deployment started:", newDeployment);

    // Your logic to check Bitbucket for newly merged PRs and process them
    // ...

    // Update deployment status to 'In Progress' or other statuses as needed
    await Deployments.updateDeploymentStatus(newDeployment.deployment_id, 'In Progress');
    
    // Assuming the deployment is processed immediately or you can set it to 'Completed' later
    await Deployments.updateDeploymentStatus(newDeployment.deployment_id, 'Completed');
  } catch (error) {
    if (error.message === 'A deployment is already in progress.') {
      console.log(error.message); // Or handle this scenario as needed
    } else {
      console.error("Error during deployment process:", error);
    }
  }
}
