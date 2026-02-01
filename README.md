# project-2fa

# How to run - 

python -m venv .venv <br>
*Windows: <br>
.venv\Scripts\activate <br>
*Mac/Linux: <br>
source .venv/bin/activate <br>

pip install -r requirements.txt <br>
python init_db.py <br>

python app.py <br>

Open - http://127.0.0.1:5000/login <br>

#6 Individualised / Skilled-based 2FA
The mathematician John Conway set up his computer so that every time he tried to log on (after entering his password), he was presented with a series of random dates for which he had to enter which day of the week each date fell.  If he did not enter the dates quickly enough (within a few seconds), he would be automatically logged out of his computer. He did this to train his ability to mentally apply the Doomsday rule (https://en.wikipedia.org/wiki/Doomsday_rule) as a party trick. This, however, is a rather clever example of an individualized, skill-based authentication system; e.g., it is an authentication system that arguably he could only do (unless someone had trained their ability to do so to the same level as he did).

A team working on this project will investigate the design/usability/security of "individualised authentication systems", e.g, solving a chess puzzle in N seconds, solving X anagrams in N seconds, etc. 
