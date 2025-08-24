"""
Main application for the IgnitoSolutions website.

This Flask app serves a multi‑page version of the site with support for
services, blog, about, contact and checkout pages. It also includes
an administrative portal. Service information, contact submissions
and orders are persisted using SQLite via SQLAlchemy.
"""

import json
from datetime import datetime

from flask import (
    Flask, render_template, request, redirect, url_for,
    session, jsonify
)
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.routing import BuildError

app = Flask(__name__)

# Secret key used for sessions; in production set via environment variable
app.config["SECRET_KEY"] = "change-me-please"
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///database.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


# ---------------------- Models ---------------------- #
class Service(db.Model):
    """Represents a service offered by IgnitoSolutions."""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, nullable=False)
    price_display = db.Column(db.String(120), nullable=False)
    image_file = db.Column(db.String(120), nullable=False)


class User(db.Model):
    """Represents an administrative user."""
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)

    def verify_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)


class Order(db.Model):
    """Represents a cart order submitted by a customer."""
    id = db.Column(db.Integer, primary_key=True)
    items_json = db.Column(db.Text, nullable=False)
    total = db.Column(db.Float, nullable=False)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    message = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Contact(db.Model):
    """Represents a contact form submission."""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# ---------------------- Seed data ---------------------- #
DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "admin123"


def seed_data() -> None:
    """Populate the database with an admin user and initial services."""
    db.create_all()

    # Create admin if none exists
    if not User.query.first():
        admin = User(
            username=DEFAULT_ADMIN_USERNAME,
            password_hash=generate_password_hash(DEFAULT_ADMIN_PASSWORD),
        )
        db.session.add(admin)
        db.session.commit()

    # Seed services if empty
    if Service.query.count() == 0:
        services_seed = [
            {
                "name": "Market Research",
                "description": "Gain deep insights into your market and customers to make informed decisions.",
                "price_display": "Starting from $2,999",
                "image_file": "market_research.png",
            },
            {
                "name": "Marketing",
                "description": "Reach your audience with effective marketing strategies and campaigns.",
                "price_display": "Design Your Bundle",
                "image_file": "lead_generation.png",
            },
            {
                "name": "Apps and Software Development",
                "description": "Build high‑quality applications and software tailored to your needs.",
                "price_display": "Starting from $9,999",
                "image_file": "apps_development.png",
            },
            {
                "name": "Business Strategy",
                "description": "Develop a clear business strategy that aligns with your goals and vision.",
                "price_display": "$2,999",
                "image_file": "business_strategy.png",
            },
            {
                "name": "Operational Reporting",
                "description": "Monitor and improve your operations with comprehensive reporting tools.",
                "price_display": "Check Monthly / Yearly Bundles",
                "image_file": "operational_reporting.png",
            },
            {
                "name": "Offshore Teams",
                "description": "Build and manage offshore call centers and social media management teams to enhance efficiency and reduce costs.",
                "price_display": "Tailored pricing",
                "image_file": "offshore_teams.png",
            },
            {
                "name": "Lead Generation",
                "description": "Generate high‑quality leads through targeted strategies and tools to grow your customer base.",
                "price_display": "Tailored pricing",
                "image_file": "lead_generation.png",
            },
        ]
        for svc in services_seed:
            db.session.add(Service(**svc))
        db.session.commit()


with app.app_context():
    db.create_all()
    seed_data()


# ---------------------- Template helpers ---------------------- #
def _compute_checkout_url() -> str:
    """
    Resolve the checkout endpoint if it exists; otherwise fall back to '/checkout'.
    NOTE: our checkout route function is named 'checkout_page'.
    """
    try:
        return url_for("checkout_page")
    except BuildError:
        return "/checkout"


@app.context_processor
def utility_processor():
    """
    Expose helper(s) and common variables to all templates.
    - has_endpoint(name): check if a view function exists.
    - checkout_url: safe URL for the checkout button/dropdown.
    """
    def has_endpoint(name: str) -> bool:
        return name in app.view_functions

    # Provide checkout_url as a value (not a function) so templates can use {{ checkout_url }}
    return dict(has_endpoint=has_endpoint, checkout_url=_compute_checkout_url())


# ---------------------- Auth utilities ---------------------- #
def admin_required(f):
    """Decorator to restrict routes to logged in administrators."""
    from functools import wraps

    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("admin_logged_in"):
            return redirect(url_for("login", next=request.path))
        return f(*args, **kwargs)

    return decorated


# ---------------------- Routes ---------------------- #
@app.route("/")
def index():
    services = Service.query.all()
    return render_template("index.html", services=services)


@app.route("/services")
def services_page():
    """Render the services page."""
    services = Service.query.all()
    return render_template("services.html", services=services)


@app.route("/about")
def about_page():
    """Serve the standalone about page."""
    return render_template("about.html")


@app.route("/blog")
def blog_page():
    """Serve the blog page (front‑end only for now)."""
    return render_template("blog.html")


@app.route("/contact", methods=["GET", "POST"])
def contact_page():
    """Render the contact page and handle AJAX form submissions."""
    if request.method == "POST":
        data = request.form
        name = data.get("name")
        email = data.get("email")
        message = data.get("message")
        if not all([name, email, message]):
            return jsonify({"status": "error", "message": "All fields are required."}), 400
        contact = Contact(name=name, email=email, message=message)
        db.session.add(contact)
        db.session.commit()
        return jsonify({"status": "success"})
    return render_template("contact.html")


@app.route("/checkout", methods=["GET"])
def checkout_page():
    """Render the checkout page."""
    return render_template("checkout.html")


@app.route("/order", methods=["POST"])
def order():
    """Handle cart checkout submissions."""
    data = request.get_json() or {}
    items = data.get("items", [])
    total = data.get("total", 0)
    name = data.get("name")
    email = data.get("email")
    message = data.get("message", "")

    if not items or not name or not email:
        return jsonify({"status": "error", "message": "Missing required information."}), 400

    order = Order(
        items_json=json.dumps(items),
        total=float(total),
        name=name,
        email=email,
        message=message,
    )
    db.session.add(order)
    db.session.commit()
    return jsonify({"status": "success"})


# ---------------------- Admin ---------------------- #
@app.route("/admin/login", methods=["GET", "POST"])
def login():
    """Render and process the admin login form."""
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        user = User.query.filter_by(username=username).first()
        if user and user.verify_password(password):
            session["admin_logged_in"] = True
            return redirect(url_for("dashboard"))
        # Fall through to re-render with error
        return render_template("login.html", error="Invalid credentials")
    return render_template("login.html")


@app.route("/admin/logout")
def logout():
    """Log out the current admin user."""
    session.pop("admin_logged_in", None)
    return redirect(url_for("login"))


@app.route("/admin/dashboard")
@admin_required
def dashboard():
    """Display the admin dashboard with services, orders and contacts."""
    services = Service.query.all()
    orders = Order.query.order_by(Order.created_at.desc()).all()
    contacts = Contact.query.order_by(Contact.created_at.desc()).all()
    return render_template("dashboard.html", services=services, orders=orders, contacts=contacts)


@app.route("/admin/services/add", methods=["GET", "POST"])
@admin_required
def add_service():
    """Add a new service via the admin portal."""
    if request.method == "POST":
        name = request.form.get("name")
        description = request.form.get("description")
        price_display = request.form.get("price_display")
        image_file = request.form.get("image_file") or "placeholder.png"

        if not all([name, description, price_display]):
            return render_template("service_form.html", error="All fields are required", service=None)

        service = Service(
            name=name,
            description=description,
            price_display=price_display,
            image_file=image_file,
        )
        db.session.add(service)
        db.session.commit()
        return redirect(url_for("dashboard"))

    return render_template("service_form.html", service=None)


@app.route("/admin/services/edit/<int:service_id>", methods=["GET", "POST"])
@admin_required
def edit_service(service_id: int):
    """Edit an existing service via the admin portal."""
    service = Service.query.get_or_404(service_id)
    if request.method == "POST":
        service.name = request.form.get("name")
        service.description = request.form.get("description")
        service.price_display = request.form.get("price_display")
        image_file = request.form.get("image_file")
        if image_file:
            service.image_file = image_file
        db.session.commit()
        return redirect(url_for("dashboard"))
    return render_template("service_form.html", service=service)


@app.route("/admin/services/delete/<int:service_id>", methods=["POST"])
@admin_required
def delete_service(service_id: int):
    """Delete a service via the admin portal."""
    service = Service.query.get_or_404(service_id)
    db.session.delete(service)
    db.session.commit()
    return redirect(url_for("dashboard"))


# ---------------------- Legal ---------------------- #
@app.route("/privacy-policy")
def privacy_policy():
    """Serve the privacy policy page."""
    return render_template("privacy-policy.html")


@app.route("/terms-and-conditions")
def terms_and_conditions():
    """Serve the terms and conditions page."""
    return render_template("terms-and-conditions.html")


# ---------------------- Entry point ---------------------- #
if __name__ == "__main__":
    app.run(debug=True)
