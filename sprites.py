import math
import pygame
from constants import *

def create_tank_surface(color, direction=UP):
    """Create a tank sprite surface with the given color facing the given direction."""
    surf = pygame.Surface((TANK_SIZE, TANK_SIZE), pygame.SRCALPHA)
    size = TANK_SIZE
    cx, cy = size // 2, size // 2

    # Tank body
    margin = 2
    body_rect = pygame.Rect(margin, margin, size - 2 * margin, size - 2 * margin)
    pygame.draw.rect(surf, color, body_rect, border_radius=3)

    # Darker shade for tracks (left and right)
    track_color = tuple(max(0, c - 40) for c in color)
    track_width = 6
    pygame.draw.rect(surf, track_color, (0, 2, track_width, size - 4), border_radius=2)
    pygame.draw.rect(surf, track_color, (size - track_width, 2, track_width, size - 4), border_radius=2)

    # Turret
    turret_radius = size // 5
    pygame.draw.circle(surf, track_color, (cx, cy), turret_radius)

    # Barrel (extends in the direction the tank faces)
    barrel_color = tuple(max(0, c - 60) for c in color)
    barrel_len = size // 2
    barrel_w = 4

    dx, dy = direction
    if dx != 0:
        barrel_rect = pygame.Rect(0, 0, barrel_len, barrel_w)
        barrel_rect.center = (cx + dx * (barrel_len // 2 - 2), cy)
    else:
        barrel_rect = pygame.Rect(0, 0, barrel_w, barrel_len)
        barrel_rect.center = (cx, cy + dy * (barrel_len // 2 - 2))

    pygame.draw.rect(surf, barrel_color, barrel_rect)

    # Rotation
    angle = DIRECTION_ANGLES.get(direction, 0)
    if angle != 0:
        surf = pygame.transform.rotate(surf, angle)

    return surf


def create_bullet_surface(color=WHITE):
    """Create a bullet sprite."""
    surf = pygame.Surface((8, 8), pygame.SRCALPHA)
    pygame.draw.circle(surf, color, (4, 4), 3)
    pygame.draw.circle(surf, WHITE, (4, 4), 1)
    return surf


def create_wall_surface(tile_type):
    """Create a wall tile surface."""
    surf = pygame.Surface((TILE_SIZE, TILE_SIZE))
    if tile_type == BRICK:
        surf.fill(BROWN)
        brick_h = TILE_SIZE // 4
        for row in range(4):
            offset = (brick_h if row % 2 == 0 else 0) // 2
            color = tuple(max(0, c - 20) for c in BROWN) if row % 2 == 0 else BROWN
            pygame.draw.rect(surf, color, (offset, row * brick_h, TILE_SIZE - offset, brick_h - 1))
        for i in range(1, 4):
            pygame.draw.line(surf, DARK_GRAY, (0, i * brick_h), (TILE_SIZE, i * brick_h), 1)
    elif tile_type == STEEL:
        surf.fill(GRAY)
        border = 2
        pygame.draw.rect(surf, DARK_GRAY, (0, 0, TILE_SIZE, border))
        pygame.draw.rect(surf, DARK_GRAY, (0, TILE_SIZE - border, TILE_SIZE, border))
        pygame.draw.rect(surf, DARK_GRAY, (0, 0, border, TILE_SIZE))
        pygame.draw.rect(surf, DARK_GRAY, (TILE_SIZE - border, 0, border, TILE_SIZE))
        for x in range(2):
            for y in range(2):
                rx = x * (TILE_SIZE - 6) + 3
                ry = y * (TILE_SIZE - 6) + 3
                pygame.draw.circle(surf, DARK_GRAY, (rx, ry), 2)
    elif tile_type == WATER:
        surf.fill(BLUE)
        for i in range(0, TILE_SIZE, 8):
            pts = []
            for x in range(0, TILE_SIZE, 4):
                y = i + 3 + int(3 * math.sin(x * 0.3 + i * 0.7))
                pts.append((x, y))
            if len(pts) > 1:
                pygame.draw.lines(surf, CYAN, False, pts, 1)
    elif tile_type == TREES:
        surf.fill(BLACK)
        for x in range(0, TILE_SIZE, 8):
            for y in range(0, TILE_SIZE, 8):
                shade = DARK_GREEN if (x + y) % 16 == 0 else GREEN
                pygame.draw.rect(surf, shade, (x, y, 8, 8))
    elif tile_type == ICE:
        surf.fill(BLACK)
        for i in range(0, TILE_SIZE, 4):
            shade = max(0, 255 - i * 8)
            pygame.draw.line(surf, (shade, shade, 255), (i, 0), (0, i))
    else:
        surf.fill(BLACK)
    return surf


def create_base_surface():
    """Create the base (eagle/flag) sprite."""
    surf = pygame.Surface((TILE_SIZE * 2, TILE_SIZE * 2), pygame.SRCALPHA)
    cx, cy = TILE_SIZE, TILE_SIZE
    pygame.draw.rect(surf, GRAY, (4, TILE_SIZE + 8, TILE_SIZE * 2 - 8, TILE_SIZE - 8), border_radius=2)
    pygame.draw.rect(surf, DARK_GRAY, (cx - 2, 4, 4, TILE_SIZE + 4))
    points = [(cx + 2, 4), (cx + TILE_SIZE - 4, cy - 4), (cx + 2, cy + 4)]
    pygame.draw.polygon(surf, YELLOW, points)
    pygame.draw.ellipse(surf, WHITE, (cx - 10, cy + 4, 20, 16))
    return surf


def create_shield_surface():
    """Create a shield overlay."""
    surf = pygame.Surface((TANK_SIZE, TANK_SIZE), pygame.SRCALPHA)
    for r in range(TANK_SIZE // 2, 3, -3):
        alpha = 100 - r * 3
        if alpha > 0:
            pygame.draw.circle(surf, (0, 100, 255, max(0, min(255, alpha))),
                               (TANK_SIZE // 2, TANK_SIZE // 2), r, 2)
    return surf


def create_explosion_surface(frame, max_frames=8):
    """Create an explosion animation frame."""
    size = TANK_SIZE * 2
    surf = pygame.Surface((size, size), pygame.SRCALPHA)
    progress = frame / max_frames
    radius = int(size // 2 * (0.3 + progress * 0.7))
    alpha = int(255 * (1 - progress))
    color1 = (255, int(200 * (1 - progress)), 0, alpha)
    color2 = (255, 255, 200, alpha)

    pygame.draw.circle(surf, color1[:3] + (alpha,), (size // 2, size // 2), radius)
    pygame.draw.circle(surf, color2[:3] + (alpha,), (size // 2, size // 2), radius // 2)

    return surf
