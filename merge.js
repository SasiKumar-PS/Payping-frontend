const fs = require('fs');

let addC = fs.readFileSync('src/pages/PayPing/AddCustomers.tsx', 'utf8');
let cust = fs.readFileSync('src/pages/PayPing/Customers.tsx', 'utf8');

// Extract the AddCustomers component from AddCustomers.tsx
const addCMatch = addC.match(/interface AddCustomersProps[\s\S]*?(?=export default AddCustomers;)/);
if (!addCMatch) {
    console.error("Could not find AddCustomers component");
    process.exit(1);
}
let addCComponent = addCMatch[0];

// Insert it into Customers.tsx just before 'const Customers = () => {'
cust = cust.replace('const Customers = () => {', addCComponent + '\n\nconst Customers = () => {');

// Update imports in Customers.tsx
cust = cust.replace(
    '} from \'lucide-react\';',
    '    Upload, ArrowRight, Download, FileText\n} from \'lucide-react\';'
);

// Remove the import of AddCustomers
cust = cust.replace("import AddCustomers from './AddCustomers';\n", '');

fs.writeFileSync('src/pages/PayPing/Customers.tsx', cust);
console.log("Merge complete");
