const fs = require('fs');
const path = require('path');

console.log('🔍 Tailwind CSS Yapılandırması Kontrol Ediliyor...\n');

// 1. PostCSS Kontrolü
const postcssPath = path.join(process.cwd(), 'postcss.config.js');
const postcssMjsPath = path.join(process.cwd(), 'postcss.config.mjs');

if (!fs.existsSync(postcssPath) && !fs.existsSync(postcssMjsPath)) {
    const postcssConfig = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
    fs.writeFileSync(postcssPath, postcssConfig);
    console.log('✅ postcss.config.js otomatik oluşturuldu.');
} else {
    console.log('✔ PostCSS konfigürasyonu mevcut.');
}

// 2. tailwind.config.js Kontrolü
const tailwindConfigPath = path.join(process.cwd(), 'tailwind.config.js');
const tailwindConfigTsPath = path.join(process.cwd(), 'tailwind.config.ts');

const defaultTailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`;

if (!fs.existsSync(tailwindConfigPath) && !fs.existsSync(tailwindConfigTsPath)) {
    fs.writeFileSync(tailwindConfigPath, defaultTailwindConfig);
    console.log('✅ tailwind.config.js varsayılan yollarla oluşturuldu.');
} else {
    console.log('✔ tailwind.config.js mevcut.');
}

// 3. CSS Direktifleri Kontrolü (globals.css veya index.css)
const possibleCssPaths = [
    './app/globals.css',
    './src/app/globals.css',
    './styles/globals.css',
    './src/index.css',
    './src/App.css'
];

let cssUpdated = false;
const tailwindDirectives = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n`;

for (const cssPath of possibleCssPaths) {
    const fullPath = path.join(process.cwd(), cssPath);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        if (!content.includes('@tailwind') && !content.includes('@import "tailwindcss"')) {
            fs.writeFileSync(fullPath, tailwindDirectives + content);
            console.log(`✅ ${cssPath} dosyasına @tailwind direktifleri eklendi.`);
        } else {
            console.log(`✔ ${cssPath} içinde Tailwind direktifleri zaten var.`);
        }
        cssUpdated = true;
        break;
    }
}

if (!cssUpdated) {
    // Eğer hiç CSS bulunamadıysa varsayılan app/globals.css oluştur
    const appDir = path.join(process.cwd(), 'app');
    if (!fs.existsSync(appDir)) fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, 'globals.css'), tailwindDirectives);
    console.log('✅ app/globals.css oluşturuldu ve @tailwind direktifleri yazıldı.');
}

console.log('\n🚀 İşlem tamamlandı! Lütfen `.next` klasörünü silip projeyi yeniden başlatın.');