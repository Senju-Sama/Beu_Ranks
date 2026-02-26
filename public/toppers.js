document.addEventListener('DOMContentLoaded', () => {
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
            const response = await fetch(`/api/toppers/${type}`);
            if (!response.ok) {
                throw new Error('Failed to fetch toppers data');
            }
            const data = await response.json();

            if (!data || data.length === 0) {
                showError("No ranking data found.");
                return;
            }

            renderToppers(data, type);
            hideLoader();
            container.classList.remove('hidden');

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

    function renderToppers(data, type) {
        container.innerHTML = '';

        // Group data logically based on the type
        const grouped = {};

        data.forEach(student => {
            let key;
            if (type === 'college') {
                key = `${student.college_name} - ${student.course_name}`;
            } else {
                key = student.course_name;
            }

            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(student);
        });

        // Loop through each group and create a section
        for (const [groupName, students] of Object.entries(grouped)) {
            const section = document.createElement('div');
            section.className = 'marks-section glass-panel slide-up';
            section.style.marginBottom = '3rem';

            // Custom header depending on group
            const headerIcon = type === 'college' ? 'fa-building-columns' : 'fa-code-branch';
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
                                ${type === 'branch' ? '<th>College</th>' : ''}
                                <th>CGPA</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${students.map(s => `
                                <tr onclick="redirectToStudent('${s.registration_no}')" style="cursor: pointer;" class="clickable-row">
                                    <td>
                                        <span class="rank-badge ${getRankBadge(type === 'college' ? s.rank_in_college_branch : s.overall_rank)}">
                                            #${type === 'college' ? s.rank_in_college_branch : s.overall_rank}
                                        </span>
                                    </td>
                                    <td>${s.registration_no}</td>
                                    <td><strong>${s.name}</strong></td>
                                    ${type === 'branch' ? `<td><small>${s.college_name}</small></td>` : ''}
                                    <td><span class="stat-value highlight" style="font-size: 1.1rem;">${s.cgpa}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            section.innerHTML = headerHTML + tableHTML;
            container.appendChild(section);
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
