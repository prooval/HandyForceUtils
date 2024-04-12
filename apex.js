// Define an async function that takes an array of Apex class names without the .cls extension.
async function getApexClassesToRun(apexClassesInPackage) {
  // Fetch Metadata IDs for all Apex classes. This function returns a map where keys are class names
  // and values are their corresponding Metadata IDs.
  const metadataIdMap = await getMetadataIdForApexClass(apexClassesInPackage);

  // Define a function to fetch dependencies recursively up to two levels deep.
  async function fetchDependencies(classNames, level) {
    if (level > 2) return new Map(); // Limit recursion to two levels.

    // Fetch dependencies for the entire list of class names.
    // Since `getDependentApexClasses` now handles internal batching, we can pass all classes at once.
    const currentDependencyMap = await getDependentApexClasses(new Map(classNames.map(name => [name, metadataIdMap[name]])));

    // Prepare for the next level of recursion if needed.
    if (level < 2) {
      // Flatten all dependencies from the current map into a unique set.
      const nextLevelClassNames = Array.from(new Set([].concat(...Array.from(currentDependencyMap.values()))));
      // Recursively fetch the next level of dependencies.
      const nextLevelDependencyMap = await fetchDependencies(nextLevelClassNames, level + 1);

      // Merge the current dependencies with the next level dependencies.
      nextLevelClassNames.forEach(className => {
        if (!currentDependencyMap.has(className) && nextLevelDependencyMap.has(className)) {
          currentDependencyMap.set(className, nextLevelDependencyMap.get(className));
        }
      });
    }

    return currentDependencyMap;
  }

  // Start fetching dependencies from the initial list of classes, starting with level 1.
  const dependencyMap = await fetchDependencies(apexClassesInPackage, 1);

  // Extract all class names from the dependency map to include all levels of dependencies.
  const allClasses = Array.from(dependencyMap.keys()).concat(...Array.from(dependencyMap.values()).flat());
  
  // Filter out the test classes from the complete list of dependent class names.
  const allTestClasses = await filterApexTestClasses(allClasses);

  // Return the list of test classes related to the initial list of Apex classes.
  return allTestClasses;
}

// Example usage of the function to demonstrate its functionality.
(async () => {
  const apexClassesInPackage = ['ExampleClass1', 'ExampleClass2'];
  const testClasses = await getApexClassesToRun(apexClassesInPackage);
  console.log('Test Classes:', testClasses);
})();

  