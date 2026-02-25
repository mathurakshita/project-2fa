# Human Centric Security "project-2fa"

## Aim:

To understand if the users would prefer using skill based 2FA to login into any system or application for added privacy.

## How to? 

### Install pre-requisites

python -m venv .venv <br>
* Windows: <br>
.venv\Scripts\activate <br> <br>
* Mac/Linux: <br>
source .venv/bin/activate <br>

pip install -r requirements.txt <br>

### Run commands

python init_db.py OR python3 init_db.py * *[according to your version of python]* <br>

python app.py OR python3 app.py * *[according to your version of python]*<br>

### Browse below - 

Open this once you've started app.py - http://127.0.0.1:8000/login <br>

### User credentials -

username: testuser <br>
P/W - Pass@123
<br>

## Individualised / Skilled-based 2FA
The mathematician John Conway set up his computer so that every time he tried to log on (after entering his password), he was presented with a series of random dates for which he had to enter which day of the week each date fell.  If he did not enter the dates quickly enough (within a few seconds), he would be automatically logged out of his computer. He did this to train his ability to mentally apply the Doomsday rule (https://en.wikipedia.org/wiki/Doomsday_rule) as a party trick. This, however, is a rather clever example of an individualized, skill-based authentication system; e.g., it is an authentication system that arguably he could only do (unless someone had trained their ability to do so to the same level as he did).

A team working on this project will investigate the design/usability/security of "individualised authentication systems", e.g, solving a chess puzzle in N seconds, solving X anagrams in N seconds, etc. 
