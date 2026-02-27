document.addEventListener('DOMContentLoaded', () => {
    // ========================================
    // Global UI Components
    // ========================================

    // Hamburger Menu Toggle
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('active');
            const isExpanded = hamburger.classList.contains('active');
            hamburger.setAttribute('aria-expanded', isExpanded);
        });

        // Close menu when clicking a link
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navLinks.classList.remove('active');
                hamburger.setAttribute('aria-expanded', 'false');
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
                hamburger.classList.remove('active');
                navLinks.classList.remove('active');
                hamburger.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Scroll to Top Button
    const scrollToTopBtn = document.getElementById('scroll-to-top');

    if (scrollToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                scrollToTopBtn.classList.add('visible');
            } else {
                scrollToTopBtn.classList.remove('visible');
            }
        });

        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // Toast Notification System
    function showToast(message, type = 'info', duration = 3000) {
        const toast = document.getElementById('toast');
        if (!toast) return;

        const icons = {
            success: '<i class="fa-solid fa-circle-check"></i>',
            error: '<i class="fa-solid fa-circle-exclamation"></i>',
            info: '<i class="fa-solid fa-circle-info"></i>'
        };

        toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
        toast.className = `toast ${type}`;

        // Trigger reflow to restart animation
        toast.offsetHeight;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }

    // Make toast function globally available
    window.showToast = showToast;

    // ========================================
    // Page-specific Logic
    // ========================================

    const loader = document.getElementById('loader');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    const container = document.getElementById('toppers-container');

    // Get the page type from script tag attribute
    const scriptTag = document.querySelector('script[src="toppers.js"]');
    const pageType = scriptTag ? scriptTag.getAttribute('data-type') : 'college';

    fetchToppers(pageType);

    async function fetchToppers(type) {
        showLoader();
        try {
            let apiUrl = '';

            // Determine API URL based on page logic
            if (type === 'college') {
                apiUrl = '/api/toppers/college';
            } else if (type === 'branch') {
                // To show all college's topper, we fetch from /api/toppers/college and filter later
                apiUrl = '/api/toppers/college';
            } else if (type === 'topper-list') {
                apiUrl = '/api/toppers/college'; // We will filter this based on URL parameters
            }

            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error('Failed to fetch toppers data');
            }
            let data = await response.json();

            if (!data || data.length === 0) {
                showError("No ranking data found.");
                showToast('No ranking data found', 'error');
                return;
            }

            renderToppers(data, type);
            hideLoader();
            container.classList.remove('hidden');
            showToast(`Loaded data successfully`, 'success');

            // Retrigger animations
            const animatedElements = document.querySelectorAll('.slide-up');
            animatedElements.forEach(el => {
                el.style.animation = 'none';
                el.offsetHeight; /* trigger reflow */
                el.style.animation = null;
            });

        } catch (error) {
            hideLoader();
            showError(error.message);
            showToast(error.message, 'error');
        }
    }

    function showLoader() {
        loader.classList.remove('hidden');
        errorMessage.classList.add('hidden');
        container.classList.add('hidden');
    }

    function hideLoader() {
        loader.classList.add('hidden');
    }

    function showError(msg) {
        errorText.textContent = msg;
        errorMessage.classList.remove('hidden');
    }

    // Helper functions for reading URL parameters
    function getQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    function renderToppers(data, type) {
        container.innerHTML = '';

        if (type === 'college') {
            const grid = document.createElement('div');
            grid.className = 'toppers-grid slide-up';

            data.forEach(college => {
                const displayName = college.college_name + (college.city ? `, ${college.city}` : '');
                grid.innerHTML += `
                    <div class="grid-card" onclick="window.location.href='topper-list.html?type=college&id=${college.college_code}&name=${encodeURIComponent(displayName)}'">
                        <i class="fa-solid fa-building-columns card-icon"></i>
                        <h3 style="font-size: 1.05rem;">${displayName}</h3>
                        <p>Click to view branch toppers</p>
                    </div>
                `;
            });
            container.appendChild(grid);

        } else if (type === 'branch') {
            const grid = document.createElement('div');
            grid.className = 'toppers-grid slide-up';

            data.forEach(branch => {
                grid.innerHTML += `
                    <div class="grid-card" onclick="window.location.href='topper-list.html?type=branch&id=${branch.course_code}&name=${encodeURIComponent(branch.course_name)}'">
                        <i class="fa-solid fa-code-branch card-icon"></i>
                        <h3 style="font-size: 1.05rem;">${branch.course_name}</h3>
                        <p>Click to view top performers across all colleges</p>
                    </div>
                `;
            });
            container.appendChild(grid);

        } else if (type === 'topper-list') {
            // Determine what we are showing based on URL
            const listType = getQueryParam('type');
            const listId = getQueryParam('id');
            const listName = getQueryParam('name');

            if (listName) {
                document.getElementById('page-title').innerHTML = `<i class="fa-solid fa-trophy header-icon"></i> ${listName}`;
                document.getElementById('page-subtitle').textContent = listType === 'college' ? 'Branch toppers for this college' : 'Top performer from each college for this branch';
            }

            let filteredData = [];
            let grouped = {};

            if (listType === 'college') {
                // Show toppers for this specific college grouped by branch
                filteredData = data.filter(s => s.college_code == listId);

                filteredData.forEach(student => {
                    const key = student.course_name;
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(student);
                });
            } else if (listType === 'branch') {
                // Show the Rank 1 students from EACH college for this specific branch
                // 'data' comes from /api/toppers/college, which has rank_in_college_branch!
                filteredData = data.filter(s => s.course_code == listId && s.rank_in_college_branch === 1);

                // Group them under a single list
                grouped['All Colleges Toppers'] = filteredData.sort((a, b) => parseFloat(b.cgpa) - parseFloat(a.cgpa));
            } else {
                showError("Invalid parameters.");
                return;
            }

            if (Object.keys(grouped).length === 0) {
                container.innerHTML = `<div class="empty-state"><p>No data found.</p></div>`;
                return;
            }

            // Render tables for groups
            for (const [groupName, students] of Object.entries(grouped)) {
                const section = document.createElement('div');
                section.className = 'marks-section glass-panel slide-up';
                section.style.marginBottom = '3rem';

                const headerIcon = listType === 'college' ? 'fa-code-branch' : 'fa-building-columns';
                const headerHTML = `
                    <h3 style="margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                        <i class="fa-solid ${headerIcon}" style="color: var(--accent-color);"></i> ${groupName}
                    </h3>
                `;

                const tableHTML = `
                    <div class="table-container">
                        <table class="toppers-table">
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Registration No</th>
                                    <th>Name</th>
                                    ${listType === 'branch' ? '<th>College</th>' : ''}
                                    <th>CGPA</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${students.map((s, index) => {
                    // If we are showing all colleges toppers, rank them logically 1, 2, 3...
                    const displayRank = listType === 'branch' ? index + 1 : s.rank_in_college_branch;
                    return `
                                    <tr onclick="redirectToStudent('${s.registration_no}')" style="cursor: pointer;" class="clickable-row">
                                        <td data-label="Rank">
                                            <span class="rank-badge ${getRankBadge(displayRank)}">
                                                #${displayRank}
                                            </span>
                                        </td>
                                        <td data-label="Reg No">${s.registration_no}</td>
                                        <td data-label="Name"><strong>${s.name}</strong></td>
                                        ${listType === 'branch' ? `<td data-label="College"><small>${s.college_name}${s.city ? ', ' + s.city : ''}</small></td>` : ''}
                                        <td data-label="CGPA"><span class="stat-value highlight" style="font-size: 1.1rem;">${s.cgpa}</span></td>
                                    </tr>
                                    `;
                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;

                section.innerHTML = headerHTML + tableHTML;
                container.appendChild(section);
            }
        }
    }

    function getRankBadge(rank) {
        if (rank === 1) return 'rank-1';
        if (rank === 2) return 'rank-2';
        if (rank === 3) return 'rank-3';
        return 'rank-other';
    }
});

// Global function to redirect to main page with search param
window.redirectToStudent = function (regNo) {
    window.location.href = `index.html?reg_no=${regNo}`;
};
