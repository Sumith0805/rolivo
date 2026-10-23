import os
import re

from dotenv import load_dotenv
from groq import Groq

load_dotenv()
key = re.sub(r"[^A-Za-z0-9_-]", "", os.getenv("GROQ_API_KEY", ""))
print("key length:", len(key))

client = Groq(api_key=key)
reply = client.chat.completions.create(
    model="openai/gpt-oss-20b",
    messages=[{"role": "user", "content": "Reply with the single word: ready"}],
)
print(reply.choices[0].message.content)