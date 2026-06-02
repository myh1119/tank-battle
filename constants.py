import pygame

# Screen
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
PLAY_WIDTH = 640
PLAY_HEIGHT = 480
PANEL_WIDTH = SCREEN_WIDTH - PLAY_WIDTH
PANEL_X = PLAY_WIDTH

# Grid
TILE_SIZE = 32
COLS = PLAY_WIDTH // TILE_SIZE   # 20
ROWS = PLAY_HEIGHT // TILE_SIZE  # 15

# Tank
TANK_SIZE = TILE_SIZE
TANK_SPEED = 3
BULLET_SPEED = 6

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
GRAY = (128, 128, 128)
DARK_GRAY = (64, 64, 64)
YELLOW = (255, 255, 0)
GREEN = (0, 255, 0)
RED = (255, 0, 0)
BLUE = (0, 0, 255)
BROWN = (139, 69, 19)
ORANGE = (255, 165, 0)
CYAN = (0, 255, 255)
DARK_GREEN = (0, 128, 0)

# Directions
UP = (0, -1)
DOWN = (0, 1)
LEFT = (-1, 0)
RIGHT = (1, 0)

DIRECTION_NAMES = {
    (0, -1): "up",
    (0, 1): "down",
    (-1, 0): "left",
    (1, 0): "right"
}

DIRECTION_ANGLES = {
    (0, -1): 0,
    (0, 1): 180,
    (-1, 0): 90,
    (1, 0): 270
}

# Game states
TITLE = 0
PLAYING = 1
GAME_OVER = 2
LEVEL_COMPLETE = 3

# Tile types
EMPTY = 0
BRICK = 1
STEEL = 2
WATER = 3
TREES = 4
ICE = 5
BASE = 6

# Tank types
PLAYER_TANK = 0
BASIC_ENEMY = 1
FAST_ENEMY = 2
ARMOR_ENEMY = 3

ENEMY_CONFIG = {
    BASIC_ENEMY: {"speed": 1.5, "fire_delay": 90, "hp": 1, "color": RED, "score": 100},
    FAST_ENEMY: {"speed": 3, "fire_delay": 60, "hp": 1, "color": ORANGE, "score": 200},
    ARMOR_ENEMY: {"speed": 1.5, "fire_delay": 120, "hp": 3, "color": DARK_GRAY, "score": 300},
}

# FPS
FPS = 60

# Player settings
PLAYER_LIVES = 3
PLAYER_FIRE_DELAY = 20
PLAYER_INVINCIBLE_FRAMES = 120
