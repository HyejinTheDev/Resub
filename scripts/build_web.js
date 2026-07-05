const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const flutterDir = path.join(rootDir, 'frontend_flutter');
const backendPublicDir = path.join(rootDir, 'backend', 'public');

function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  fs.readdirSync(from).forEach((element) => {
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    if (fs.lstatSync(fromPath).isDirectory()) {
      copyFolderSync(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  });
}

function cleanFolderSync(folder) {
  if (fs.existsSync(folder)) {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

try {
  console.log('🚀 Step 1: Compiling Flutter Web Application...');
  execSync('flutter build web --release', {
    cwd: flutterDir,
    stdio: 'inherit'
  });

  console.log('\n🧹 Step 2: Cleaning backend public folder...');
  cleanFolderSync(backendPublicDir);

  console.log('\n📁 Step 3: Copying Flutter build assets to backend/public...');
  const flutterBuildOutputDir = path.join(flutterDir, 'build', 'web');
  copyFolderSync(flutterBuildOutputDir, backendPublicDir);

  console.log('\n✅ Build completed successfully! Static files are now ready in backend/public.');
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}
