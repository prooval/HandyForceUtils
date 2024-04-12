async function getApexClassesToRun(apexClassesInPackage) {
    // Step 1: Get Metadata IDs for all Apex classes
    const metadataIdMap = await getMetadataIdForApexClass(apexClassesInPackage);
  
    // Step 2: Get all dependencies for these Apex classes, batched and with 2 levels deep
    const allDependencies = new Map();
  
    async function fetchDependencies(classNames, level) {
      if (level > 2) return;  // Limit recursion to two levels
      while (classNames.length > 0) {
        const batch = classNames.splice(0, 25);
        const dependentClassesMap = await getDependentApexClasses(new Map(batch.map(name => [name, metadataIdMap[name]])));
        for (const [className, dependencies] of Object.entries(dependentClassesMap)) {
          if (!allDependencies.has(className)) {
            allDependencies.set(className, dependencies);
            // Recurse for new dependencies not already in the map
            await fetchDependencies(dependencies.filter(dep => !allDependencies.has(dep)), level + 1);
          }
        }
      }
    }
  
    // Start dependency fetching from level 1
    await fetchDependencies([...apexClassesInPackage], 1);
  
    // Step 3: Using the dependency map, find all test classes
    const allClasses = Array.from(allDependencies.values()).flat();
    const allTestClasses = await filterApexTestClasses(allClasses);
  
    // Return the filtered test classes
    return allTestClasses;
  }
  
  // Example usage
  (async () => {
    const apexClassesInPackage = ['ExampleClass1', 'ExampleClass2'];
    const testClasses = await getApexClassesToRun(apexClassesInPackage);
    console.log('Test Classes:', testClasses);
  })();
  