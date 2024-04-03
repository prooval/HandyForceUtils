// path/filename: src/parsePackageXml.js

const fs = require('fs');
const xml2js = require('xml2js');
const util = require('util');

// Promisify readFile and parseString for async/await usage
const readFileAsync = util.promisify(fs.readFile);
const parseStringAsync = util.promisify(new xml2js.Parser().parseString);

/**
 * Reads and parses a package.xml file to extract included metadata types.
 * @param {string} filePath Path to the package.xml file.
 * @returns {Promise<string[]>} A promise that resolves with an array of metadata type names.
 */
async function extractMetadataTypes(filePath) {
  try {
    // Read the package.xml file
    const xmlContent = await readFileAsync(filePath, 'utf8');
    
    // Convert XML content to JSON
    const result = await parseStringAsync(xmlContent);
    
    // Extract metadata types from JSON
    const types = result.Package.types.map(type => type.name[0]);
    
    return types;
  } catch (error) {
    console.error('Error extracting metadata types:', error);
    throw error; // Rethrow to handle it in the calling context
  }
}

module.exports = extractMetadataTypes;


// path/filename: src/parsePackageXml.js

const fs = require('fs');
const xml2js = require('xml2js');
const util = require('util');

// Promisify readFile and parseString for async/await usage
const readFileAsync = util.promisify(fs.readFile);
const parseStringAsync = util.promisify(new xml2js.Parser().parseString);

/**
 * Reads and parses a package.xml file to extract included metadata types and,
 * if present, the names of ApexClass types.
 * @param {string} filePath Path to the package.xml file.
 * @returns {Promise<Object>} A promise that resolves with an object containing arrays of metadata type names
 *                            and ApexClass names (if any).
 */
async function extractMetadataTypesAndApexClasses(filePath) {
  try {
    // Read the package.xml file
    const xmlContent = await readFileAsync(filePath, 'utf8');
    
    // Convert XML content to JSON
    const result = await parseStringAsync(xmlContent);
    
    // Extract metadata types from JSON
    const types = result.Package.types.reduce((acc, type) => {
      const typeName = type.name[0];
      acc[typeName] = type.members.map(member => member);
      return acc;
    }, {});
    
    // Prepare result object
    const metadataTypes = Object.keys(types);
    const apexClasses = types['ApexClass'] || [];

    return {
      metadataTypes,
      apexClasses
    };
  } catch (error) {
    console.error('Error extracting metadata types and Apex classes:', error);
    throw error; // Rethrow to handle it in the calling context
  }
}

module.exports = extractMetadataTypesAndApexClasses;

const fs = require('fs').promises;
const path = require('path');
const simpleGit = require('simple-git');

const APEX_CLASS_DIR = 'path/to/apex/classes/directory'; // Adjust this to your actual Apex class directory path

/**
 * Asynchronously filters Apex test classes that provide coverage for given Apex classes.
 * @param {string[]} apexClassNames List of Apex class names to find coverage for.
 * @returns {Promise<string[]>} A promise that resolves with names of Apex test classes providing coverage.
 */
async function findTestClassesForApexClasses(apexClassNames) {
    const allApexFiles = await fs.readdir(APEX_CLASS_DIR);
    const testClassNames = [];

    for (const fileName of allApexFiles) {
        if (fileName.endsWith('.cls')) { // Ensure we're only processing Apex class files
            const filePath = path.join(APEX_CLASS_DIR, fileName);
            const content = await fs.readFile(filePath, 'utf8');

            // Determine if the current file is a test class
            if (isTestClass(content)) {
                for (const apexClassName of apexClassNames) {
                    if (content.includes(apexClassName)) {
                        testClassNames.push(fileName);
                        break; // No need to check other class names once a match is found
                    }
                }
            }
        }
    }

    return testClassNames;
}

/**
 * Determines if the given class file content indicates a test class.
 * @param {string} content The content of the Apex class file.
 * @returns {boolean} True if the content indicates a test class, false otherwise.
 */
function isTestClass(content) {
    // Simplified check: real implementation may need to be more sophisticated
    return content.includes('@isTest') || /@TestSetup/.test(content);
}

// Example usage
findTestClassesForApexClasses(['FinancialAcctService'])
    .then(testClasses => console.log('Test classes:', testClasses))
    .catch(error => console.error('Error:', error));

    const fs = require('fs').promises;
    const path = require('path');
    
    const APEX_CLASS_DIR = 'path/to/apex/classes/directory'; // Adjust to your actual directory path
    
    /**
     * Reads Apex class files and constructs a dependency graph.
     * @returns {Promise<Map<string, Set<string>>>} A promise that resolves with a dependency graph.
     */
    async function buildDependencyGraph() {
        const files = await fs.readdir(APEX_CLASS_DIR);
        const graph = new Map();
    
        for (const fileName of files) {
            if (fileName.endsWith('.cls')) {
                const content = await fs.readFile(path.join(APEX_CLASS_DIR, fileName), 'utf8');
                const className = fileName.replace('.cls', '');
                const dependencies = extractClassDependencies(content);
    
                graph.set(className, new Set(dependencies));
            }
        }
    
        return graph;
    }
    
    /**
     * Extracts class names that the given Apex class file content depends on.
     * @param {string} content The content of the Apex class file.
     * @returns {string[]} List of class names the file depends on.
     */
    function extractClassDependencies(content) {
        // This is a simplified version. Actual implementation may need to parse the content more thoroughly.
        const dependencyPattern = /new\s+([A-Za-z0-9_]+)/g;
        const matches = content.matchAll(dependencyPattern);
        const dependencies = [...matches].map(match => match[1]);
    
        return dependencies;
    }
    
    /**
     * Finds test classes that provide direct or indirect coverage for the specified Apex classes.
     * @param {Map<string, Set<string>>} dependencyGraph The dependency graph of Apex classes.
     * @param {string[]} targetClasses Names of target Apex classes to find coverage for.
     * @returns {string[]} Names of test classes providing coverage.
     */
    function findTestClassesCovering(dependencyGraph, targetClasses) {
        // Placeholder for actual logic to traverse the graph and identify covering test classes.
        // This would involve searching the graph for paths from test classes to the target classes,
        // including indirect paths through dependencies.
    }
    
    // Example usage
    buildDependencyGraph().then(graph => {
        const testClasses = findTestClassesCovering(graph, ['FinancialService']);
        console.log('Test classes covering FinancialService:', testClasses);
    }).catch(error => console.error('Error building dependency graph:', error));

    /**
 * Traverses the dependency graph to find test classes that provide coverage for the specified classes.
 * @param {Map<string, Set<string>>} graph The dependency graph of Apex classes.
 * @param {string[]} targetClasses Names of target Apex classes to find coverage for.
 * @returns {Set<string>} Names of test classes providing coverage.
 */
function findTestClassesCovering(graph, targetClasses) {
    const visited = new Set();
    const coverage = new Set();

    // Helper function for DFS
    const dfs = (node) => {
        if (visited.has(node) || !graph.has(node)) return;
        visited.add(node);

        if (isTestClass(node)) {
            coverage.add(node);
        }

        const neighbors = graph.get(node) || [];
        neighbors.forEach(neighbor => dfs(neighbor));
    };

    // Perform DFS for each target class
    targetClasses.forEach(target => dfs(target));

    return coverage;
}

/**
 * Determines if a given class name indicates a test class.
 * @param {string} className The name of the Apex class.
 * @returns {boolean} True if the class name suggests it's a test class, false otherwise.
 */
function isTestClass(className) {
    // This is a simplified heuristic; adjust according to your project's naming conventions
    return className.endsWith('Test') || className.endsWith('Tests');
}

// Assuming the graph has been built and target classes are defined
// Example usage:
// buildDependencyGraph().then(graph => {
//     const testClasses = findTestClassesCovering(graph, ['FinancialService']);
//     console.log('Test classes covering FinancialService:', [...testClasses]);
// }).catch(error => console.error('Error:', error));

/**
 * Extracts class names that the given Apex class file content depends on, considering
 * direct instantiation, static access, inheritance, and interface implementation.
 * @param {string} content The content of the Apex class file.
 * @returns {string[]} List of unique class names the file depends on.
 */
function extractClassDependencies(content) {
    const patterns = [
        /new\s+([A-Za-z0-9_]+)/g, // Matches new instance creation
        /([A-Za-z0-9_]+)\./g, // Matches static method calls or property access
        /extends\s+([A-Za-z0-9_]+)/g, // Matches class inheritance
        /implements\s+([A-Za-z0-9_]+)/g // Matches interface implementation
    ];

    const allDependencies = new Set();

    patterns.forEach(pattern => {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
            // Match group 1 contains the class/interface name
            allDependencies.add(match[1]);
        }
    });

    // Filter out any known non-class keywords that might have been caught by the patterns
    const knownNonClasses = new Set(['System', 'String', 'Integer', 'Boolean']); // Add more as necessary
    const dependencies = [...allDependencies].filter(dep => !knownNonClasses.has(dep));

    return dependencies;
}

// Assuming buildDependencyGraph() creates a normal dependency graph

/**
 * Builds a reverse dependency graph.
 * @param {Map<string, Set<string>>} graph The original dependency graph.
 * @returns {Map<string, Set<string>>} The reverse dependency graph.
 */
function buildReverseDependencyGraph(graph) {
    const reverseGraph = new Map();

    graph.forEach((dependencies, className) => {
        dependencies.forEach((dependency) => {
            if (!reverseGraph.has(dependency)) {
                reverseGraph.set(dependency, new Set());
            }
            reverseGraph.get(dependency).add(className);
        });
    });

    return reverseGraph;
}

/**
 * Uses DFS to find all classes that, directly or indirectly, depend on the given class.
 * @param {Map<string, Set<string>>} reverseGraph The reverse dependency graph.
 * @param {string} targetClass The class to find coverage for.
 * @returns {Set<string>} Set of class names that depend on the target class.
 */
function findClassesWithCoverageFor(reverseGraph, targetClass) {
    const visited = new Set();
    const stack = [targetClass];
    const result = new Set();

    while (stack.length > 0) {
        const current = stack.pop();
        if (!visited.has(current)) {
            visited.add(current);
            const dependents = reverseGraph.get(current) || [];
            dependents.forEach(dependent => {
                result.add(dependent);
                stack.push(dependent);
            });
        }
    }

    return result;
}

// Assuming we have the original graph
// const graph = await buildDependencyGraph();
// const reverseGraph = buildReverseDependencyGraph(graph);
// const coverageProviders = findClassesWithCoverageFor(reverseGraph, 'FinancialAccountService');

// Assuming isTestClass() identifies test classes correctly, filter the results to get only test classes
// const testClassesProvidingCoverage = Array.from(coverageProviders).filter(isTestClass);

// Assuming buildDependencyGraph() creates a normal dependency graph

/**
 * Builds a reverse dependency graph.
 * @param {Map<string, Set<string>>} graph The original dependency graph.
 * @returns {Map<string, Set<string>>} The reverse dependency graph.
 */
function buildReverseDependencyGraph(graph) {
    const reverseGraph = new Map();

    graph.forEach((dependencies, className) => {
        dependencies.forEach((dependency) => {
            if (!reverseGraph.has(dependency)) {
                reverseGraph.set(dependency, new Set());
            }
            reverseGraph.get(dependency).add(className);
        });
    });

    return reverseGraph;
}

/**
 * Uses DFS to find all classes that, directly or indirectly, depend on the given class.
 * @param {Map<string, Set<string>>} reverseGraph The reverse dependency graph.
 * @param {string} targetClass The class to find coverage for.
 * @returns {Set<string>} Set of class names that depend on the target class.
 */
function findClassesWithCoverageFor(reverseGraph, targetClass) {
    const visited = new Set();
    const stack = [targetClass];
    const result = new Set();

    while (stack.length > 0) {
        const current = stack.pop();
        if (!visited.has(current)) {
            visited.add(current);
            const dependents = reverseGraph.get(current) || [];
            dependents.forEach(dependent => {
                result.add(dependent);
                stack.push(dependent);
            });
        }
    }

    return result;
}

// Assuming we have the original graph
// const graph = await buildDependencyGraph();
// const reverseGraph = buildReverseDependencyGraph(graph);
// const coverageProviders = findClassesWithCoverageFor(reverseGraph, 'FinancialAccountService');

// Assuming isTestClass() identifies test classes correctly, filter the results to get only test classes
// const testClassesProvidingCoverage = Array.from(coverageProviders).filter(isTestClass);

const fs = require('fs');
const path = require('path');
const { ApexParser } = require('@apexdevtools/apex-parser');

/**
 * Extracts class dependencies from an Apex file using an AST.
 * @param {string} apexFilePath Path to the Apex class file.
 * @returns {Set<string>} A set of unique class names that are dependencies.
 */
function extractClassDependencies(apexFilePath) {
    const content = fs.readFileSync(apexFilePath, 'utf8');
    const parser = new ApexParser();
    const ast = parser.parse(content);

    const dependencies = new Set();

    // Function to recursively traverse the AST
    function traverseNode(node) {
        if (!node) return;

        // Example: Check if node is a type reference (e.g., for new instances or static access)
        if (node.nodeType === 'TypeReference' && node.name) {
            dependencies.add(node.name.value);
        }

        // Traverse children
        Object.values(node).forEach(value => {
            if (Array.isArray(value)) {
                value.forEach(childNode => traverseNode(childNode));
            } else if (typeof value === 'object') {
                traverseNode(value);
            }
        });
    }

    traverseNode(ast);

    return dependencies;
}

// Example usage
const apexFilePath = path.join(__dirname, 'YourApexClass.cls');
const dependencies = extractClassDependencies(apexFilePath);
console.log(dependencies);

