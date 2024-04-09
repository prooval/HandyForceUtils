const fs = require('fs').promises; // Use the promise-based version of the fs module
const path = require('path');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
const builder = new xml2js.Builder();

const predefinedProfiles = [
  'Profile1', 'Profile2', 'Profile3', 'Profile4', 'Profile5',
  'Profile6', 'Profile7', 'Profile8', 'Profile9', 'Profile10'
];

const mergeProfilesInPackageXml = async (filePath) => {
  try {
    const data = await fs.readFile(filePath);
    const result = await parser.parseStringPromise(data);

    if (!result.Package.types) {
      throw new Error('Invalid package.xml format.');
    }

    let profileEntry = result.Package.types.find(entry => entry.name && entry.name[0] === 'Profile');

    if (profileEntry) {
      const currentProfiles = new Set(profileEntry.members.map(member => member.toString()));
      predefinedProfiles.forEach(profile => currentProfiles.add(profile));

      profileEntry.members = Array.from(currentProfiles).sort().map(profile => ({ _: profile }));
    } else {
      result.Package.types.push({
        name: ['Profile'],
        members: predefinedProfiles.map(profile => ({ _: profile }))
      });
    }

    const xml = builder.buildObject(result);
    const directory = path.dirname(filePath);
    const newFilePath = path.join(directory, 'package-combined.xml');

    await fs.writeFile(newFilePath, xml);
    return true; // Indicate success
  } catch (err) {
    console.error('Error during the operation:', err);
    throw err; // Propagate the error to be caught by the caller
  }
};

// Usage example
mergeProfilesInPackageXml('path/to/your/package.xml')
  .then(success => {
    console.log('Operation success:', success);
  })
  .catch(error => {
    console.error('Operation failed:', error);
  });


// Replace 'path/to/your/package.xml' with the actual file path
mergeProfilesInPackageXml('path/to/your/package.xml');
