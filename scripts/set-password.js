// Përdorimi: npm run set-password -- "fjalëkalimi_i_ri"
const { setAdminPassword } = require('../db');
const pw = process.argv[2];
if (!pw || pw.length < 8) {
  console.error('Jep një fjalëkalim me të paktën 8 karaktere:\n  npm run set-password -- "fjalëkalimi_i_ri"');
  process.exit(1);
}
setAdminPassword(pw);
console.log('Fjalëkalimi u ndryshua.');
