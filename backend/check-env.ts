import { env } from "./src/config.js";

console.log('\n=== SUPERADMIN CREDENTIALS FROM ENV ===\n');
console.log(`SUPERADMIN_EMAIL: "${env.SUPERADMIN_EMAIL}"`);
console.log(`SUPERADMIN_PASSWORD: "${env.SUPERADMIN_PASSWORD}"`);
console.log(`\nEmail length: ${env.SUPERADMIN_EMAIL.length}`);
console.log(`Password length: ${env.SUPERADMIN_PASSWORD.length}`);
console.log('\n');
