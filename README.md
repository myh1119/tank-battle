# 坦克大战 (Tank Battle)

A classic Battle City style tank battle game built with Python and Pygame.

## Features

- Player tank (yellow) with keyboard controls
- Enemy tanks (red, orange, gray) with basic AI
- 3 unique levels with brick walls, steel walls, water, and trees
- Destructible base (eagle) that must be protected
- Score tracking and lives system
- Explosion animations and shield effects
- Progressive difficulty with armored enemies

## How to Play

| Key | Action |
|-----|--------|
| ↑ ↓ ← → | Move tank |
| W / A / S / D | Move tank |
| SPACE / J | Shoot |
| ENTER | Start game / Next level |
| ESC | Back to title / Quit |

## Installation

```bash
pip install -r requirements.txt
# or if pygame-ce isn't available:
pip install pygame-ce
python main.py
```

## Game Rules

- Destroy all enemy tanks to clear a stage
- Protect your base (eagle flag) at the bottom center
- You have 3 lives per game
- Enemies spawn from the top of the map
- Brick walls can be destroyed by bullets
- Steel walls are indestructible
- Armored enemies require multiple hits to destroy

## Project Structure

```
tank-battle/
├── main.py          # Entry point
├── game.py          # Game loop and state management
├── entities.py      # Tank, Bullet, Wall, Base, Explosion classes
├── sprites.py       # Programmatic sprite generation
├── map_data.py      # Level definitions
├── constants.py     # Game constants and configuration
├── requirements.txt # Dependencies
└── .gitignore
```

## License

MIT
