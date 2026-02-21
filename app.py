"""
Flask entry point for the Gun-Wall Game simulation dashboard.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # noqa: E402

from flask import Flask, render_template  # noqa: E402
from api.routes import api_bp  # noqa: E402

app = Flask(__name__)
app.register_blueprint(api_bp)


@app.route('/')
def index():
    return render_template('index.html')


if __name__ == '__main__':
    app.run(debug=True, port=5001)
