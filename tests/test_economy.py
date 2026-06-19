from tests.conftest import make_npc, make_state
from shogun.systems.economy import player_bribe, bribe_cost
from shogun.core.constants import NpcClass, NPC_CLASS_DATA, BRIBE_DURATION


def test_bribe_succeeds_with_enough_yen():
    npc = make_npc(npc_class=NpcClass.BANDIT)
    state = make_state(npc)
    cost = bribe_cost(npc)
    state.player.yen = cost + 10
    player_bribe(state, npc)
    assert npc.bribed_until_tick == BRIBE_DURATION
    assert state.player.yen == 10


def test_bribe_fails_with_insufficient_yen():
    npc = make_npc(npc_class=NpcClass.LORD)
    state = make_state(npc)
    state.player.yen = 5
    msg = player_bribe(state, npc)
    assert "Not enough" in msg
    assert npc.bribed_until_tick == -1


def test_cannot_bribe_dead_npc():
    npc = make_npc()
    npc.is_dead = True
    state = make_state(npc)
    msg = player_bribe(state, npc)
    assert "dead" in msg


def test_cannot_bribe_existing_follower():
    npc = make_npc()
    npc.is_follower = True
    state = make_state(npc)
    msg = player_bribe(state, npc)
    assert "already" in msg
