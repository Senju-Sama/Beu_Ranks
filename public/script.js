document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-form');
    const regInput = document.getElementById('reg-input');
    const loader = document.getElementById('loader');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    const resultContainer = document.getElementById('result-container');
    const simulateBtn = document.getElementById('simulate-btn');

    let theoryChart = null;
    let practicalChart = null;

    // Simulation State
    let isSimulating = false;
    let baseData = null; // The original unaltered payload
    let mockData = null; // The clone used for simulation overrides

    // Check for reg_no in URL parameters (for Topper page redirection)
    const urlParams = new URLSearchParams(window.location.search);
    const prefillRegNo = urlParams.get('reg_no');

    if (prefillRegNo) {
        regInput.value = prefillRegNo;
        // Trigger the search automatically
        setTimeout(() => searchForm.dispatchEvent(new Event('submit')), 100);
    }

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const regNo = regInput.value.trim();
        if (!regNo) return;

        // UI Reset
        hideAll();
        showLoader();

        try {
            const response = await fetch(`/api/student/${regNo}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch student data');
            }

            const data = await response.json();

            // Setup base data cache
            baseData = JSON.parse(JSON.stringify(data));
            mockData = JSON.parse(JSON.stringify(data));
            isSimulating = false;
            if (simulateBtn) simulateBtn.classList.remove('active');

            renderData(data);
            hideLoader();
            resultContainer.classList.remove('hidden');

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
    });

    function hideAll() {
        loader.classList.add('hidden');
        errorMessage.classList.add('hidden');
        resultContainer.classList.add('hidden');
    }

    function showLoader() {
        loader.classList.remove('hidden');
    }

    function hideLoader() {
        loader.classList.add('hidden');
    }

    function showError(msg) {
        errorText.textContent = msg;
        errorMessage.classList.remove('hidden');
    }

    function renderData(data) {
        // Populate Student Info
        document.getElementById('student-name').textContent = data.student.name;
        document.getElementById('student-reg').textContent = data.student.registration_no;
        document.getElementById('student-father').textContent = data.student.father_name;
        document.getElementById('student-mother').textContent = data.student.mother_name;
        document.getElementById('student-college').textContent = `${data.student.college.college_name} (${data.student.college.city})`;
        document.getElementById('student-course').textContent = data.student.course.course_name;
        document.getElementById('university-name').textContent = data.university;

        // Populate Performance Stats
        document.getElementById('student-cgpa').textContent = data.performance.cgpa;
        document.getElementById('student-crank').textContent = data.performance.college_branch_rank;
        document.getElementById('student-urank').textContent = data.performance.overall_branch_rank;

        const remarksEl = document.getElementById('student-remarks');
        remarksEl.textContent = data.performance.remarks;

        // Style remarks
        remarksEl.className = 'stat-value';
        const remLower = (data.performance.remarks || '').toLowerCase();
        if (remLower.includes('pass')) remarksEl.classList.add('remark-pass');
        else if (remLower.includes('fail')) remarksEl.classList.add('remark-fail');
        else remarksEl.classList.add('remark-check');

        // Render Tables
        renderTable('theory-table', data.subjects.theory, false);
        renderTable('practical-table', data.subjects.practical, true);

        // Render Chart
        renderChart(data);
    }

    function renderTable(tableId, subjectsArr, isPractical = false) {
        const tbody = document.querySelector(`#${tableId} tbody`);
        tbody.innerHTML = '';

        if (!subjectsArr || subjectsArr.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">No subjects found</td></tr>';
            return;
        }

        subjectsArr.forEach((sub, index) => {
            const tr = document.createElement('tr');

            // Find original subject to check if changed
            let originalSub = null;
            if (baseData) {
                const baseArray = isPractical ? baseData.subjects.practical : baseData.subjects.theory;
                originalSub = baseArray.find(s => s.subject_code === sub.subject_code);
            }
            const hasChanged = originalSub && parseInt(originalSub.total) !== parseInt(sub.total);

            // Format grade for css class compatibility (e.g. A+ -> A_plus)
            let gradeClass = (sub.grade || '').replace('+', '_plus');

            let totalHtml = `<strong>${sub.total}</strong>`;

            // If in simulation mode, swap text for input fields
            if (isSimulating) {
                totalHtml = `<input type="number" 
                    class="simulator-input" 
                    min="0" max="100" 
                    value="${sub.total === 'NE' ? 0 : sub.total}" 
                    data-is-practical="${isPractical}" 
                    data-code="${sub.subject_code}"
                />`;
            }

            tr.innerHTML = `
                <td>${sub.subject_code}</td>
                <td><strong>${sub.subject_name}</strong></td>
                <td>${sub.credit}</td>
                <td>${sub.ese}</td>
                <td>${sub.ia}</td>
                <td class="${hasChanged ? 'simulated-value' : ''}">${totalHtml}</td>
                <td><span class="grade grade-${gradeClass}">${sub.grade}</span></td>
            `;
            tbody.appendChild(tr);
        });

        // Add event listeners tracking input changes
        if (isSimulating) {
            const inputs = tbody.querySelectorAll('.simulator-input');
            inputs.forEach(input => {
                input.addEventListener('change', (e) => {
                    handleSimulationChange(e.target);
                });
            });
        }
    }

    function renderChart(data) {
        // Prepare data for Theory Chart
        const theoryCtx = document.getElementById('theoryChart').getContext('2d');
        const theorySubjects = data.subjects.theory || [];
        const theoryToppers = data.toppers.theory || [];

        const theoryLabels = theorySubjects.map(sub => sub.subject_code);
        const theoryMarks = theorySubjects.map(sub => sub.total); // Simulated or Original depending on state
        const theoryOriginalMarks = baseData ? baseData.subjects.theory.map(sub => sub.total) : theoryMarks;

        // Map topper marks corresponding to the subject code
        const theoryTopperMarks = theoryLabels.map(code => {
            const topper = theoryToppers.find(t => t.subject_code === code);
            return topper && topper.max_total ? parseInt(topper.max_total) : 0;
        });

        // Destroy existing theory chart instance if exists
        if (theoryChart) {
            theoryChart.destroy();
        }

        theoryChart = createComparisonChart(theoryCtx, theoryLabels, theoryOriginalMarks, theoryMarks, theoryTopperMarks, theorySubjects);

        // Prepare data for Practical Chart
        const practicalCtx = document.getElementById('practicalChart').getContext('2d');
        const practicalSubjects = data.subjects.practical || [];
        const practicalToppers = data.toppers.practical || [];

        const practicalLabels = practicalSubjects.map(sub => sub.subject_code);
        const practicalMarks = practicalSubjects.map(sub => sub.total);
        const practicalOriginalMarks = baseData ? baseData.subjects.practical.map(sub => sub.total) : practicalMarks;

        // Map topper marks corresponding to the subject code
        const practicalTopperMarks = practicalLabels.map(code => {
            const topper = practicalToppers.find(t => t.subject_code === code);
            return topper && topper.max_total ? parseInt(topper.max_total) : 0;
        });

        // Destroy existing practical chart instance if exists
        if (practicalChart) {
            practicalChart.destroy();
        }

        practicalChart = createComparisonChart(practicalCtx, practicalLabels, practicalOriginalMarks, practicalMarks, practicalTopperMarks, practicalSubjects);
    }

    function createComparisonChart(ctx, labels, originalData, simulatedData, topperData, subjectDetails) {
        const datasets = [];

        if (isSimulating) {
            datasets.push({
                label: 'Original Score',
                data: originalData,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderColor: 'rgba(255, 255, 255, 0.5)',
                borderWidth: 1,
                borderRadius: 4,
            });
            datasets.push({
                label: 'Simulated Score',
                data: simulatedData,
                backgroundColor: 'rgba(137, 87, 229, 0.8)', // Purple color indicating simulation
                borderColor: 'rgba(137, 87, 229, 1)',
                borderWidth: 1,
                borderRadius: 4,
            });
        } else {
            datasets.push({
                label: 'Your Score',
                data: originalData,
                backgroundColor: 'rgba(88, 166, 255, 0.8)', // Original Blue
                borderColor: 'rgba(88, 166, 255, 1)',
                borderWidth: 1,
                borderRadius: 4,
            });
        }

        // Always show the topper dataset
        datasets.push({
            label: 'Topper Score',
            data: topperData,
            backgroundColor: 'rgba(210, 153, 34, 0.8)', // Gold/Yellow color
            borderColor: 'rgba(210, 153, 34, 1)',
            borderWidth: 1,
            borderRadius: 4,
        });

        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: { color: '#8b949e' }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: { color: '#8b949e' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#e6edf3' }
                    },
                    tooltip: {
                        callbacks: {
                            title: function (context) {
                                // Find subject name for tooltip
                                const idx = context[0].dataIndex;
                                return subjectDetails[idx].subject_name;
                            }
                        }
                    }
                }
            }
        });
    }

    if (simulateBtn) {
        simulateBtn.addEventListener('click', () => {
            isSimulating = !isSimulating;
            if (isSimulating) {
                simulateBtn.classList.add('active');
                simulateBtn.innerHTML = '<i class="fa-solid fa-check"></i> Exit Simulation';
            } else {
                simulateBtn.classList.remove('active');
                simulateBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Simulate Result';
                // Revert to base data when exiting
                mockData = JSON.parse(JSON.stringify(baseData));
            }
            renderData(mockData);
        });
    }

    function handleSimulationChange(inputEl) {
        const isPractical = inputEl.getAttribute('data-is-practical') === 'true';
        const subjectCode = inputEl.getAttribute('data-code');
        let newTotal = parseInt(inputEl.value, 10);

        if (isNaN(newTotal) || newTotal < 0) newTotal = 0;

        // Find and update the subject in the mock data
        const targetArray = isPractical ? mockData.subjects.practical : mockData.subjects.theory;
        const subject = targetArray.find(s => s.subject_code === subjectCode);

        if (subject) {
            subject.total = newTotal;
            // Recalculate Grade based on BEU Scheme
            subject.grade = calculateGrade(newTotal, isPractical);

            // Recalculate Overall SGPA Mock
            recalculateSGPA();

            // Re-render
            renderData(mockData);
        }
    }

    function calculateGrade(marks, isPractical) {
        if (marks >= 90) return 'A+';
        if (marks >= 80) return 'A';
        if (marks >= 70) return 'B';
        if (marks >= 60) return 'C';
        if (marks >= 50) return 'D';

        const failThreshold = isPractical ? 40 : 35;
        if (marks >= failThreshold) return 'P';

        return 'F';
    }

    function calculateGradePoint(grade) {
        const points = {
            'A+': 10, 'A': 9, 'B': 8, 'C': 7,
            'D': 6, 'P': 5, 'F': 0
        };
        return points[grade] || 0;
    }

    async function recalculateSGPA() {
        let totalCreditPoints = 0;
        let totalCredits = 0;

        const allSubjects = [
            ...(mockData.subjects.theory || []),
            ...(mockData.subjects.practical || [])
        ];

        allSubjects.forEach(sub => {
            const credit = parseFloat(sub.credit);
            if (!isNaN(credit)) {
                const gp = calculateGradePoint(sub.grade);
                totalCreditPoints += (gp * credit);
                totalCredits += credit;
            }
        });

        const newSgpa = totalCredits > 0 ? (totalCreditPoints / totalCredits).toFixed(2) : 0;
        mockData.performance.cgpa = `(Sim. SGPA) ${newSgpa}`;

        // Disable ranks while simulating to show loading state
        mockData.performance.college_branch_rank = '...';
        mockData.performance.overall_branch_rank = '...';
        mockData.performance.remarks = 'SIMULATED';

        // Re-render immediately to show SGPA and loading state on ranks
        renderData(mockData);

        // Fetch simulated ranks asynchronously
        try {
            const college_code = baseData.student.college.college_code;
            const course_code = baseData.student.course.course_code;

            const response = await fetch(`/api/simulate/rank?college_code=${college_code}&course_code=${course_code}&sgpa=${newSgpa}`);

            if (response.ok) {
                const rankData = await response.json();

                // Update the mock data with fresh backend ranks
                mockData.performance.college_branch_rank = `(Sim.) ${rankData.simulated_college_rank}`;
                mockData.performance.overall_branch_rank = `(Sim.) ${rankData.simulated_overall_rank}`;

                // Only re-render if the user is STILL simulating 
                if (isSimulating) {
                    renderData(mockData);
                }
            }
        } catch (err) {
            console.error('Failed to fetch simulated ranks:', err);
            mockData.performance.college_branch_rank = '-';
            mockData.performance.overall_branch_rank = '-';
            if (isSimulating) renderData(mockData);
        }
    }
});
