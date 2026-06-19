import pygame

# Custom pygame event IDs (registered at module import time)
ZONE_TRANSITION = pygame.event.custom_type()   # data: {zone_id, position}
NPC_DIED = pygame.event.custom_type()          # data: {npc_id}
NPC_RESPAWNED = pygame.event.custom_type()     # data: {npc_id}
FOLLOWER_GAINED = pygame.event.custom_type()   # data: {npc_id}
ITEM_PICKED_UP = pygame.event.custom_type()    # data: {item_name}
GAME_WON = pygame.event.custom_type()
GAME_LOST = pygame.event.custom_type()
SHOW_ORDER_UI = pygame.event.custom_type()     # data: {npc_id}
