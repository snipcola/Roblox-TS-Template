const fs = require("fs");
const path = require("path");

function fetchDirectory(originalPath) {
  let path;

  function getParent(_path) {
    const array = _path.split("/");
    return array.splice(0, array.length - 1).join("/");
  }

  function check(_path) {
    function checkParent() {
      const parent = getParent(_path);
      if (parent) check(parent);
    }

    if (fs.existsSync(_path) && fs.statSync(_path).isDirectory()) path = _path;
    else checkParent();
  }

  check(originalPath);
  return path;
}

function fetchModules(contents) {
  const tsImportRegex = /TS\.import\(([^)]+)\)/g;
  const requireRegex = /local\s+TS\s*=\s*require\(([^)]+)\)/g;

  const paths = [];
  let match;

  while ((match = tsImportRegex.exec(contents)) !== null) {
    const args = match[1];
    const argArray = args.split(",").map((arg) => arg.trim());

    if (argArray.some((arg) => arg.includes("node_modules"))) {
      const nodeModulesIndex = argArray.findIndex((arg) =>
        arg.includes("node_modules"),
      );
      const pathParts = argArray
        .slice(nodeModulesIndex)
        .map((arg) => arg.replace(/['"]/g, "").trim());
      const path = pathParts.join("/");
      const directory = fetchDirectory(path);

      if (directory) paths.push(directory);
    }
  }

  if ((match = requireRegex.exec(contents)) !== null) {
    const arg = match[1];

    if (arg === "script.include.RuntimeLib") {
      paths.push("include/RuntimeLib.lua");
      paths.push("include/Promise.lua");
    }
  }

  return paths;
}

function findInitFiles(module) {
  const paths = [];

  try {
    const files = fs.readdirSync(module);

    files.forEach(function (file) {
      const filePath = path.join(module, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        paths.push(...findInitFiles(filePath));
      } else if (file.endsWith(".lua") || file.endsWith(".luau")) {
        paths.push(filePath);
      }
    });
  } catch (e) {
    return;
  }

  return paths;
}

function moveFile(file) {
  const distPath = file.startsWith("include")
    ? path.join("dist", file)
    : path.join("dist", "include", file);
  const distDir = path.dirname(distPath);

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  fs.copyFileSync(file, distPath);
}

function prepareLuaFile(path) {
  const contents = fs.readFileSync(path, "utf8");
  const modules = fetchModules(contents);
  const files = modules
    .map((m) => (m.startsWith("include") ? m : findInitFiles(m)))
    .flat()
    .filter((v) => typeof v === "string");

  [...new Set(files)].map(moveFile);
}

prepareLuaFile("dist/init.luau");
