class ThemeManager {
    constructor() {
        this.themes = [
            {
                name: 'Teal',
                primary: '#499fa4',
                secondary: '#3d4a55',
                accent: '#e9bc8b',
                background: '#f5f7fb',
                text: '#2c3e50'
            },
            {
                name: 'Emerald',
                primary: '#148b4b',
                secondary: '#3d4a55',
                accent: '#b7bda9',
                background: '#f5f7fb',
                text: '#2c3e50'
            },
            {
                name: 'Spearmint',
                primary: '#599d9c',
                secondary: '#3d4a55',
                accent: '#e9bc8b',
                background: '#f5f7fb',
                text: '#2c3e50'
            },
            {
                name: 'Blue Green',
                primary: '#16796f',
                secondary: '#3d4a55',
                accent: '#b7bda9',
                background: '#f5f7fb',
                text: '#2c3e50'
            }
        ];
        
        this.currentThemeIndex = 0;
        this.init();
    }
    
    init() {
        this.applyTheme(0);
        setInterval(() => this.rotateTheme(), 60000); // Change every 1 minute
    }
    
    rotateTheme() {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % this.themes.length;
        this.applyTheme(this.currentThemeIndex);
    }
    
    applyTheme(index) {
        const theme = this.themes[index];
        const root = document.documentElement;
        
        // Update CSS variables
        root.style.setProperty('--primary', theme.primary);
        root.style.setProperty('--secondary', theme.secondary);
        root.style.setProperty('--accent', theme.accent);
        root.style.setProperty('--background', theme.background);
        root.style.setProperty('--text', theme.text);
        
        // Update any elements that need specific theming
        document.querySelectorAll('.status-indicator.connected i').forEach(el => {
            el.style.color = theme.primary;
        });
        
        document.querySelectorAll('.stat-icon i').forEach(el => {
            el.style.color = theme.primary;
        });
    }
}

// Initialize theme manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
});
