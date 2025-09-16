/**
 * PyWMP Documentation - Main JavaScript File
 * Provides consistent functionality across all documentation pages
 */

class PyWMPDocs {
    constructor() {
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.setupSearch();
        this.setupSmoothScrolling();
        this.setupTableOfContents();
        this.setupCodeCopyButtons();
        this.setupFilterButtons();
        this.setupProgressTracking();
        this.setupThemeToggle();
        this.setupMobileMenu();
        
        console.log('PyWMP Documentation initialized');
    }

    // Search functionality
    setupSearch() {
        const searchInputs = document.querySelectorAll('[data-search]');
        
        searchInputs.forEach(input => {
            const targetSelector = input.dataset.search;
            const searchableItems = document.querySelectorAll(targetSelector);
            
            input.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase().trim();
                this.filterItems(searchableItems, searchTerm);
            });
            
            // Clear search on escape
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    input.value = '';
                    this.filterItems(searchableItems, '');
                }
            });
        });
    }

    filterItems(items, searchTerm) {
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            const isVisible = searchTerm === '' || text.includes(searchTerm);
            
            item.style.display = isVisible ? '' : 'none';
            
            // Add search highlight
            if (searchTerm && isVisible) {
                this.highlightText(item, searchTerm);
            } else {
                this.removeHighlight(item);
            }
        });
        
        // Update result count
        this.updateSearchResults(items, searchTerm);
    }

    highlightText(element, searchTerm) {
        // Simple text highlighting
        const text = element.textContent;
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        
        if (element.querySelector('.search-highlight')) {
            this.removeHighlight(element);
        }
        
        const highlighted = text.replace(regex, '<mark class="search-highlight">$1</mark>');
        
        if (highlighted !== text) {
            element.innerHTML = highlighted;
        }
    }

    removeHighlight(element) {
        const highlights = element.querySelectorAll('.search-highlight');
        highlights.forEach(highlight => {
            highlight.outerHTML = highlight.textContent;
        });
    }

    updateSearchResults(items, searchTerm) {
        const resultCounter = document.querySelector('[data-search-results]');
        if (!resultCounter) return;
        
        const visibleCount = Array.from(items).filter(item => 
            item.style.display !== 'none'
        ).length;
        
        const totalCount = items.length;
        
        if (searchTerm) {
            resultCounter.textContent = `Showing ${visibleCount} of ${totalCount} items`;
            resultCounter.style.display = 'block';
        } else {
            resultCounter.style.display = 'none';
        }
    }

    // Smooth scrolling for anchor links
    setupSmoothScrolling() {
        const links = document.querySelectorAll('a[href^="#"]');
        
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                const targetId = link.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                
                if (targetElement) {
                    e.preventDefault();
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                    
                    // Update URL without triggering scroll
                    history.pushState(null, null, targetId);
                }
            });
        });
    }

    // Generate table of contents
    setupTableOfContents() {
        const tocContainer = document.querySelector('[data-toc]');
        if (!tocContainer) return;
        
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        if (headings.length === 0) return;
        
        const tocList = document.createElement('ul');
        tocList.className = 'toc-list';
        
        headings.forEach((heading, index) => {
            // Generate ID if it doesn't exist
            if (!heading.id) {
                heading.id = `heading-${index}`;
            }
            
            const listItem = document.createElement('li');
            listItem.className = `toc-item toc-level-${heading.tagName.toLowerCase()}`;
            
            const link = document.createElement('a');
            link.href = `#${heading.id}`;
            link.textContent = heading.textContent;
            link.className = 'toc-link';
            
            listItem.appendChild(link);
            tocList.appendChild(listItem);
        });
        
        tocContainer.appendChild(tocList);
    }

    // Copy code blocks to clipboard
    setupCodeCopyButtons() {
        const codeBlocks = document.querySelectorAll('pre code, .code-block');
        
        codeBlocks.forEach(codeBlock => {
            const container = codeBlock.parentElement;
            
            // Create copy button
            const copyButton = document.createElement('button');
            copyButton.className = 'code-copy-btn btn btn-secondary';
            copyButton.textContent = 'Copy';
            copyButton.setAttribute('aria-label', 'Copy code to clipboard');
            
            // Position button
            container.style.position = 'relative';
            copyButton.style.position = 'absolute';
            copyButton.style.top = '0.5rem';
            copyButton.style.right = '0.5rem';
            copyButton.style.zIndex = '10';
            
            container.appendChild(copyButton);
            
            // Copy functionality
            copyButton.addEventListener('click', async () => {
                const text = codeBlock.textContent;
                
                try {
                    await navigator.clipboard.writeText(text);
                    copyButton.textContent = 'Copied!';
                    copyButton.classList.add('success');
                    
                    setTimeout(() => {
                        copyButton.textContent = 'Copy';
                        copyButton.classList.remove('success');
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy text: ', err);
                    copyButton.textContent = 'Error';
                    
                    setTimeout(() => {
                        copyButton.textContent = 'Copy';
                    }, 2000);
                }
            });
        });
    }

    // Filter buttons functionality
    setupFilterButtons() {
        const filterGroups = document.querySelectorAll('[data-filter-group]');
        
        filterGroups.forEach(group => {
            const buttons = group.querySelectorAll('[data-filter]');
            const targetSelector = group.dataset.filterGroup;
            const items = document.querySelectorAll(targetSelector);
            
            buttons.forEach(button => {
                button.addEventListener('click', () => {
                    const filter = button.dataset.filter;
                    
                    // Update button states
                    buttons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    
                    // Filter items
                    this.applyFilter(items, filter);
                });
            });
        });
    }

    applyFilter(items, filter) {
        items.forEach(item => {
            if (filter === 'all') {
                item.style.display = '';
            } else {
                const itemCategories = item.dataset.category || '';
                const isVisible = itemCategories.includes(filter);
                item.style.display = isVisible ? '' : 'none';
            }
        });
    }

    // Progress tracking for documentation requirements
    setupProgressTracking() {
        const progressContainers = document.querySelectorAll('[data-progress]');
        
        progressContainers.forEach(container => {
            const items = container.querySelectorAll('[data-status]');
            const progressBar = container.querySelector('.progress-bar');
            const progressText = container.querySelector('.progress-text');
            
            if (!items.length) return;
            
            const completed = Array.from(items).filter(item => 
                item.dataset.status === 'complete'
            ).length;
            
            const total = items.length;
            const percentage = Math.round((completed / total) * 100);
            
            if (progressBar) {
                progressBar.style.width = `${percentage}%`;
            }
            
            if (progressText) {
                progressText.textContent = `${completed}/${total} completed (${percentage}%)`;
            }
        });
    }

    // Theme toggle (if needed)
    setupThemeToggle() {
        const themeToggle = document.querySelector('[data-theme-toggle]');
        if (!themeToggle) return;
        
        const currentTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', currentTheme);
        
        themeToggle.addEventListener('click', () => {
            const newTheme = document.documentElement.getAttribute('data-theme') === 'light' 
                ? 'dark' : 'light';
            
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    // Mobile menu toggle
    setupMobileMenu() {
        const menuToggle = document.querySelector('[data-menu-toggle]');
        const menu = document.querySelector('[data-menu]');
        
        if (!menuToggle || !menu) return;
        
        menuToggle.addEventListener('click', () => {
            menu.classList.toggle('mobile-open');
            menuToggle.setAttribute('aria-expanded', 
                menu.classList.contains('mobile-open')
            );
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && !menuToggle.contains(e.target)) {
                menu.classList.remove('mobile-open');
                menuToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Utility methods
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Public API methods
    updateProgress() {
        this.setupProgressTracking();
    }

    refreshSearch() {
        this.setupSearch();
    }
}

// Initialize when script loads
const pywmpDocs = new PyWMPDocs();

// Expose to global scope for external use
window.PyWMPDocs = pywmpDocs;

// CSS for JavaScript-added elements
const styles = `
<style>
.search-highlight {
    background-color: yellow;
    padding: 2px 0;
}

.code-copy-btn {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    opacity: 0.7;
    transition: opacity 0.2s ease;
}

.code-copy-btn:hover {
    opacity: 1;
}

.code-copy-btn.success {
    background-color: var(--color-accent);
    color: white;
}

.toc-list {
    list-style: none;
    padding: 0;
}

.toc-item {
    margin-bottom: 0.25rem;
}

.toc-level-h1 .toc-link { font-weight: 600; }
.toc-level-h2 .toc-link { padding-left: 1rem; }
.toc-level-h3 .toc-link { padding-left: 2rem; }
.toc-level-h4 .toc-link { padding-left: 3rem; }

.toc-link {
    display: block;
    padding: 0.25rem 0;
    color: var(--text-muted);
    text-decoration: none;
    border-radius: var(--radius-sm);
    transition: var(--transition-fast);
}

.toc-link:hover {
    color: var(--color-primary);
    background-color: var(--color-primary-light);
    text-decoration: none;
}

.progress-bar {
    height: 8px;
    background-color: var(--color-accent);
    border-radius: var(--radius-sm);
    transition: width 0.3s ease;
}

.progress-container {
    width: 100%;
    height: 8px;
    background-color: var(--bg-muted);
    border-radius: var(--radius-sm);
    margin-bottom: 0.5rem;
}

.mobile-open {
    display: block !important;
}

@media (max-width: 768px) {
    .nav ul {
        display: none;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--bg-primary);
        border-top: 1px solid var(--bg-muted);
        flex-direction: column;
        z-index: 1000;
    }
    
    .nav ul.mobile-open {
        display: flex;
    }
}
</style>
`;

// Inject styles
document.head.insertAdjacentHTML('beforeend', styles);
