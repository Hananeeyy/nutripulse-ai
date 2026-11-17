let globalTargets = null;

function goToStep(stepNum) {
    document.getElementById('wizard-step-1').classList.add('hidden');
    document.getElementById('wizard-step-2').classList.add('hidden');
    document.getElementById('wizard-step-3').classList.add('hidden');
    
    document.getElementById(`wizard-step-${stepNum}`).classList.remove('hidden');
    
    document.getElementById('current-step-num').textContent = stepNum;
    const stepBadge = document.getElementById('step-badge');
    stepBadge.textContent = stepNum;

    if (stepNum === 1) {
        document.getElementById('step-title').textContent = "Body Profile & Physical Metrics";
        document.getElementById('step-desc').textContent = "Enter your biometrics and select your primary goal.";
    } else if (stepNum === 2) {
        document.getElementById('step-title').textContent = "Medical Routing, Allergies & Dislikes";
        document.getElementById('step-desc').textContent = "Specify any restrictions or health considerations for your plan.";
    } else if (stepNum === 3) {
        document.getElementById('step-title').textContent = "Clinical Diet Plan & Macro Dashboard";
        document.getElementById('step-desc').textContent = "Your customized AI nutritional roadmap.";
    }
}

async function submitStep1() {
    const weight = document.getElementById('weight').value;
    const height = document.getElementById('height').value;
    const age = document.getElementById('age').value;
    const gender = document.getElementById('gender').value;
    const selectedGoal = document.querySelector('input[name="goal"]:checked') ? document.querySelector('input[name="goal"]:checked').value : 'maintain';

    try {
        const res = await fetch('/api/calculate-initial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weight, height, age, gender, goal: selectedGoal })
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            globalTargets = data.targets;
            document.getElementById('res-bmi').textContent = globalTargets.bmi;
            document.getElementById('res-calories').textContent = globalTargets.calories + " kcal";
            document.getElementById('res-protein').textContent = globalTargets.protein + "g";
            document.getElementById('res-carbs').textContent = globalTargets.carbs + "g";
            document.getElementById('res-fat').textContent = globalTargets.fat + "g";

            goToStep(2);
        } else {
            alert('Error calculating metrics.');
        }
    } catch (err) {
        console.error(err);
        alert('Server connection error.');
    }
}

async function submitStep2() {
    const allergies = document.getElementById('allergies').value;
    const dislikes = document.getElementById('dislikes').value;
    const has_medical_issues = document.getElementById('has_medical_issues').checked;

    goToStep(3);

    if (has_medical_issues) {
        document.getElementById('consultation-warning').classList.remove('hidden');
        document.getElementById('consultation-msg').textContent = "Due to reported health/medical conditions, we require a human nutritionist consultation prior to plan delivery for safety.";
        document.getElementById('meals-list').innerHTML = '';
        return;
    } else {
        document.getElementById('consultation-warning').classList.add('hidden');
    }

    document.getElementById('meals-list').innerHTML = '<p class="text-slate-400 text-sm animate-pulse">Generating your custom AI diet plan...</p>';

    try {
        const res = await fetch('/api/generate-final-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                targets: globalTargets,
                allergies: allergies,
                dislikes: dislikes,
                has_medical_issues: has_medical_issues
            })
        });
        const data = await res.json();

        if (data.status === 'consultation_required') {
            document.getElementById('consultation-warning').classList.remove('hidden');
            document.getElementById('consultation-msg').textContent = data.message;
            document.getElementById('meals-list').innerHTML = '';
        } else if (data.status === 'success') {
            let html = '';
            data.plan.meals.forEach((meal, index) => {
                html += `
                    <div id="meal-card-${index}" class="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                        <div class="flex justify-between items-center">
                            <span class="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-semibold uppercase tracking-wider">${meal.category}</span>
                            <div class="flex items-center gap-3">
                                <span class="text-xs text-slate-400">${meal.calories} kcal</span>
                                <button onclick="swapMeal('${meal.food}', '${meal.protein}g protein, ${meal.carbs}g carbs, ${meal.fat}g fat', ${index})" class="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 transition font-medium">Swap</button>
                            </div>
                        </div>
                        <h4 id="meal-food-${index}" class="font-bold text-white text-base">${meal.food}</h4>
                        <p id="meal-portion-${index}" class="text-xs text-slate-400">Portion: ${meal.portion}</p>
                        <div class="flex gap-4 text-xs text-slate-300 pt-2 border-t border-slate-900">
                            <span>Protein: <b id="meal-protein-${index}">${meal.protein}</b>g</span>
                            <span>Carbs: <b id="meal-carbs-${index}">${meal.carbs}</b>g</span>
                            <span>Fat: <b id="meal-fat-${index}">${meal.fat}</b>g</span>
                        </div>
                    </div>
                `;
            });
            document.getElementById('meals-list').innerHTML = html;
        } else {
            alert(data.message || 'Error generating plan');
        }
    } catch (err) {
        console.error(err);
        alert('Failed to connect to AI server.');
    }
}

async function swapMeal(currentFood, targetMacros, index) {
    const foodEl = document.getElementById(`meal-food-${index}`);
    const portionEl = document.getElementById(`meal-portion-${index}`);
    const proteinEl = document.getElementById(`meal-protein-${index}`);
    const carbsEl = document.getElementById(`meal-carbs-${index}`);
    const fatEl = document.getElementById(`meal-fat-${index}`);

    const originalText = foodEl.textContent;
    foodEl.textContent = "Finding alternative...";

    try {
        const res = await fetch('/api/swap-food', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_food: currentFood, target_macros: targetMacros })
        });
        const data = await res.json();

        if (data.status === 'success') {
            const item = data.item;
            foodEl.textContent = item.new_food;
            portionEl.textContent = `Portion: ${item.portion}`;
            proteinEl.textContent = item.protein;
            carbsEl.textContent = item.carbs;
            fatEl.textContent = item.fat;
        } else {
            alert('Could not swap food item.');
            foodEl.textContent = originalText;
        }
    } catch (err) {
        console.error(err);
        alert('Swap failed.');
        foodEl.textContent = originalText;
    }
}