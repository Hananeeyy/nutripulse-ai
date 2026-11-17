import os
import json
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from dotenv import load_dotenv
from google import genai

load_dotenv()

app = Flask(__name__)

# Flask secret key for secure session management
app.secret_key = "nutripulse_secure_secret_key"

# Direct API key configuration
client = genai.Client(api_key="AIzaSyD2Mq4Fu0rT_rL66_SuVE_dOZs-pZHRaPM")

def calculate_targets(weight, height, age, gender="male", goal="maintain"):
    height_m = height / 100
    bmi = round(weight / (height_m ** 2), 2)
    
    if gender.lower() == "female":
        bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161
    else:
        bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5

    # Baseline maintenance calculation
    maintenance = bmr * 1.375

    # Adjust calories and macros based on goal
    if goal.lower() == "muscle_gain":
        calories = round(maintenance + 350) # Caloric surplus
        protein = round(weight * 2.2)
    elif goal.lower() == "fat_loss":
        calories = round(maintenance - 400) # Caloric deficit
        protein = round(weight * 2.2)
    else: # maintain
        calories = round(maintenance)
        protein = round(weight * 1.8)

    fat = round((calories * 0.25) / 9)
    carbs = round((calories - (protein * 4) - (fat * 9)) / 4)

    return {
        "bmi": bmi,
        "calories": calories,
        "protein": protein,
        "fat": fat,
        "carbs": carbs,
        "goal": goal,
        "vitamin_a": "900 mcg",
        "vitamin_c": "90 mg",
        "vitamin_d": "600 IU",
        "calcium": "1000 mg",
        "iron": "18 mg",
        "zinc": "11 mg"
    }

@app.route("/login")
def login_page():
    return render_template("login.html")

@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.json
    email = data.get("email")
    password = data.get("password")
    
    if email and password:
        session["user_email"] = email
        return jsonify({"status": "success"})
    return jsonify({"status": "error", "message": "Invalid credentials"}), 400

@app.route("/logout")
def logout():
    session.pop("user_email", None)
    return redirect(url_for("login_page"))

@app.route("/")
def index():
    if "user_email" not in session:
        return redirect(url_for("login_page"))
    return render_template("index.html")

@app.route("/api/calculate-initial", methods=["POST"])
def calculate_initial():
    data = request.json
    weight = float(data.get("weight", 70))
    height = float(data.get("height", 175))
    age = int(data.get("age", 25))
    gender = data.get("gender", "male")
    goal = data.get("goal", "maintain")
    
    targets = calculate_targets(weight, height, age, gender, goal)
    return jsonify({"status": "success", "targets": targets})

@app.route("/api/generate-final-plan", methods=["POST"])
def generate_final_plan():
    data = request.json
    targets = data.get("targets")
    has_medical_issues = data.get("has_medical_issues", False)

    if has_medical_issues:
        return jsonify({
            "status": "consultation_required",
            "message": "Due to reported health/medical conditions, we require a human nutritionist consultation prior to plan delivery for safety."
        })

    calories = targets.get('calories', 2000)
    instant_plan = {
        "meals": [
            {
                "category": "Breakfast",
                "food": "Oatmeal with Almond Butter, Berries & Whey Protein",
                "portion": "1 bowl (60g oats + 1 scoop protein)",
                "calories": round(calories * 0.25),
                "protein": round(targets.get('protein', 120) * 0.3),
                "carbs": 45,
                "fat": 10
            },
            {
                "category": "Lunch",
                "food": "Grilled Chicken Breast with Quinoa & Steamed Broccoli",
                "portion": "1 plate (180g chicken + 1 cup quinoa)",
                "calories": round(calories * 0.35),
                "protein": round(targets.get('protein', 120) * 0.4),
                "carbs": 50,
                "fat": 12
            },
            {
                "category": "Snack",
                "food": "Greek Yogurt with Honey & Mixed Nuts",
                "portion": "1 cup (150g)",
                "calories": round(calories * 0.15),
                "protein": round(targets.get('protein', 120) * 0.15),
                "carbs": 20,
                "fat": 8
            },
            {
                "category": "Dinner",
                "food": "Baked Salmon with Sweet Potato & Asparagus",
                "portion": "1 fillet (160g salmon + 1 medium sweet potato)",
                "calories": round(calories * 0.25),
                "protein": round(targets.get('protein', 120) * 0.15),
                "carbs": 35,
                "fat": 14
            }
        ]
    }
    return jsonify({"status": "success", "plan": instant_plan})

@app.route("/api/swap-food", methods=["POST"])
def swap_food():
    data = request.json
    current_food = data.get("current_food")
    target_macros = data.get("target_macros")

    prompt = f"""
    Suggest an alternative food item that replaces '{current_food}' while keeping similar macro-nutrients ({target_macros}).
    Return ONLY a JSON object with keys: "new_food", "portion", "calories", "protein", "carbs", "fat".
    """
    
    models_to_try = ['gemini-3.8-flash', 'gemini-2.0-flash']
    response = None

    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config={'response_mime_type': 'application/json'},
            )
            if response and response.text:
                try:
                    return jsonify({"status": "success", "item": json.loads(response.text)})
                except Exception:
                    continue
        except Exception:
            continue

    fallback_item = {
        "new_food": "Grilled Paneer/Tofu Salad Bowl",
        "portion": "1 bowl (150g)",
        "calories": 320,
        "protein": 20,
        "carbs": 18,
        "fat": 12
    }
    return jsonify({"status": "success", "item": fallback_item})

if __name__ == "__main__":
    app.run(debug=True, port=5000)