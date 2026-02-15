"""
Flask entry point for the Gun-Wall Game simulation dashboard.
"""
import sys
import os

# Ensure project root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, render_template
from api.routes import api_bp

app = Flask(__name__)
app.register_blueprint(api_bp)


@app.route('/')
def index():
    return render_template('index.html')


if __name__ == '__main__':
    app.run(debug=True, port=5000)
