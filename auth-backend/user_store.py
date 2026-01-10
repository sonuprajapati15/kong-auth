from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash
from models import User
import os

mongo_uri = os.environ.get(
    "MONGO_URI",
    "mongodb://my_user:mypassword@localhost:27019/admin"
)
client = MongoClient(mongo_uri)
db = client["user_db"]  # Explicitly use the 'user_db' database
users_col = db["users"]


def create_user(email, role, password, kong_consumer_id, jwt_credential_id):
    if users_col.find_one({"email": email}):
        raise ValueError("User already exists")
    user_doc = {
        "email": email,
        "role": role,
        "kong_consumer_id": kong_consumer_id,
        "jwt_credential_id": jwt_credential_id,
        "password_hash": generate_password_hash(password),
    }
    result = users_col.update_one(
        {"email": email},
        {
            "$set": {
                "role": role,
                "kong_consumer_id": kong_consumer_id,
                "jwt_credential_id": jwt_credential_id,
            },
            "$setOnInsert": {"email": email,
                             "password_hash": generate_password_hash(password)
                             },
        },
        upsert=True,
    )
    return User(**user_doc)


def update_user_id(email, kong_consumer_id, jwt_credential_id):
    users_col.update_one(
        {"email": email},
        {
            "$set": {
                "kong_consumer_id": kong_consumer_id,
                "jwt_credential_id": jwt_credential_id,
            }
        },
        upsert=True,
    )


def get_user(email):
    user_doc = users_col.find_one({"email": email})
    if user_doc:
        user_doc.pop("_id", None)
        return User(**user_doc)
    return None


def verify_password(user, password):
    return check_password_hash(user.password_hash, password)
