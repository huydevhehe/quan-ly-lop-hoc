import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

describe('khong con phu thuoc code cu (dbStorage/firebase) trong component', () => {
  const componentFiles = listFiles(join(__dirname, '../components')).filter((f) =>
    f.endsWith('.tsx')
  );
  const files = [...componentFiles, join(__dirname, '../App.tsx')];

  it.each(files)('%s khong import firebase hoac dbStorage', (file) => {
    const content = readFileSync(file, 'utf-8');
    expect(content).not.toMatch(/from ['"].*\/firebase['"]/);
    expect(content).not.toMatch(/from ['"].*\/dbStorage['"]/);
  });
});
