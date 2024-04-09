const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
const builder = new xml2js.Builder();

// Predefined profile names to merge
const predefinedProfiles = [
  'Profile1', 'Profile2', 'Profile3', 'Profile4', 'Profile5',
  'Profile6', 'Profile7', 'Profile8', 'Profile9', 'Profile10'
];

const mergeProfilesInPackageXml = (filePath) => {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error('Error reading the file:', err);
      return;
    }

    parser.parseString(data, (err, result) => {
      if (err) {
        console.error('Error parsing XML:', err);
        return;
      }

      if (!result.Package.types) {
        console.error('Invalid package.xml format.');
        return;
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

      // Determine the path for the new file in the same directory
      const directory = path.dirname(filePath);
      const newFilePath = path.join(directory, 'package-combined.xml');

      // Write the updated XML to a new file
      fs.writeFile(newFilePath, xml, (err) => {
        if (err) {
          console.error('Error writing the new package-combined.xml:', err);
          return;
        }
        console.log('package-combined.xml has been generated successfully.');
      });
    });
  });
};

// Replace 'path/to/your/package.xml' with the actual file path
mergeProfilesInPackageXml('path/to/your/package.xml');
