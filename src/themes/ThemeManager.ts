import { darkTheme } from './dark';
import { lightTheme } from './light';

export class ThemeManager {
  private currentTheme: 'dark' | 'light' = 'dark';
  private container: HTMLElement | null = null;

  setContainer(el: HTMLElement): void {
    this.container = el;
    this.applyTheme();
  }

  setTheme(theme: 'dark' | 'light'): void {
    this.currentTheme = theme;
    this.applyTheme();
  }

  getTheme(): 'dark' | 'light' {
    return this.currentTheme;
  }

  toggleTheme(): 'dark' | 'light' {
    this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme();
    return this.currentTheme;
  }

  private applyTheme(): void {
    if (!this.container) return;
    const vars = this.currentTheme === 'dark' ? darkTheme : lightTheme;
    for (const [key, value] of Object.entries(vars)) {
      this.container.style.setProperty(key, value);
    }
    this.container.dataset.theme = this.currentTheme;
  }
}
