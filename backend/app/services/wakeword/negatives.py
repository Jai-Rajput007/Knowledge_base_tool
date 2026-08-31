"""Auto-generate phonetically confusable negative phrases for wake word training."""

import re
from typing import List


# Common fillers that pair with any wake word
_FILLERS = [
    "hey", "okay", "hello", "hi", "yo", "oh",
    "hey there", "hey bro", "hey dude", "hey listen",
    "hey wait", "hey check", "hey stop", "hey look",
]

# Vowel substitution map for phonetic confusion
_VOWEL_SUBS = {
    "a": ["e", "u", "ah", "aa"],
    "e": ["a", "i", "eh"],
    "i": ["e", "ee", "ih"],
    "o": ["u", "oh", "oa"],
    "u": ["o", "uh", "oo"],
}

# Common ending substitutions
_ENDING_SUBS = {
    "is": ["iz", "iss", "ice", "us", "es"],
    "ai": ["ay", "eye", "i", "ae"],
    "jai": ["jay", "jai singh", "jye", "gy", "kai", "mai", "lai", "chai", "bye", "rye"],
    "jarvis": ["jarviss", "jarviz", "jarvus", "jervis", "gervais", "harvest", "travis",
                "mavis", "avis", "harvis", "jharvis"],
    "daksh": ["dax", "dusk", "task", "disk", "dusk", "daks"],
    "raghav": ["raghu", "ragav", "raagav", "ragu", "raghab", "regard", "rugged"],
}


def generate(wake_phrase: str, count: int = 60) -> List[str]:
    """
    Generate negative phrases for a given wake phrase.
    Covers phonetic confusions, partial matches, rhythm matches.
    """
    phrase = wake_phrase.lower().strip()
    words  = phrase.split()
    negatives = set()

    # 1. Fillers — these always go in
    negatives.update(_FILLERS)

    # 2. Individual words from the phrase
    negatives.update(words)

    # 3. Partial phrase (first word only, second word only)
    if len(words) >= 2:
        negatives.add(words[0])
        negatives.add(" ".join(words[1:]))

    # 4. Known substitutions for each word
    for word in words:
        if word in _ENDING_SUBS:
            for sub in _ENDING_SUBS[word]:
                rest = [w for w in words if w != word]
                negatives.add(" ".join(rest + [sub]).strip())
                negatives.add(" ".join([sub] + rest).strip())

    # 5. Vowel substitutions on last word
    last_word = words[-1]
    for vowel, subs in _VOWEL_SUBS.items():
        if vowel in last_word:
            for sub in subs:
                mutated = last_word.replace(vowel, sub, 1)
                negatives.add(" ".join(words[:-1] + [mutated]).strip())

    # 6. Common assistant commands with the last word
    last_word = words[-1]
    for prefix in ["call", "message", "open", "play", "find", "okay"]:
        negatives.add(f"{prefix} {last_word}")

    # 7. Drop "hey" if present, add other greetings
    if words[0] == "hey":
        rest = " ".join(words[1:])
        for greeting in ["hello", "hi", "yo", "okay"]:
            negatives.add(f"{greeting} {rest}")

    # 8. Rhyming last syllable (simple: swap last consonant cluster)
    last = words[-1]
    if len(last) > 3:
        stem = last[:-2]
        for end in ["ay", "ee", "ah", "ow", "uh"]:
            negatives.add(" ".join(words[:-1] + [stem + end]).strip())

    # Remove empty strings and the actual wake phrase
    negatives.discard("")
    negatives.discard(phrase)

    result = sorted(negatives)

    # If we have fewer than count, pad with common background conversation phrases
    extras = [
        "what time is it", "can you help me", "where is the exit",
        "i need assistance", "thank you", "excuse me", "one moment please",
        "could you please", "i am looking for", "how do i get to",
        "background noise", "white noise", "music playing",
        # Real ambient-conversation false positives captured during live
        # wakeword testing (2026-08-31 session) — genuine nearby speech that
        # scored high on acoustic similarity without containing the wake
        # phrase, not synthetic guesses.
        "are you still not free", "he's out with", "read that one",
        "i think i'll", "still in the back", "a nice people",
    ]
    for extra in extras:
        if len(result) >= count:
            break
        if extra not in result:
            result.append(extra)

    return result[:count]
