from tests.conftest import make_npc, make_state
from shogun.systems.combat import player_attack, update_combat
from shogun.core.constants import NpcClass, NPC_DRAIN_RATE, PLAYER_DRAIN_RATE


def test_attack_sets_combat_target():
    npc = make_npc()
    state = make_state(npc)
    player_attack(state, npc)
    assert npc.combat_target == "player"
    assert state.player.combat_target == npc.id


def test_cannot_attack_follower():
    npc = make_npc()
    npc.is_follower = True
    state = make_state(npc)
    msg = player_attack(state, npc)
    assert "already" in msg
    assert npc.combat_target is None


def test_energy_drains_on_contact():
    npc = make_npc()
    state = make_state(npc)
    npc_start_energy = npc.energy
    player_attack(state, npc)
    # player and npc at same position → contact
    update_combat(state)
    assert npc.energy < npc_start_energy
    assert state.player.energy < 100.0


def test_npc_yields_at_zero_energy():
    npc = make_npc()
    state = make_state(npc)
    player_attack(state, npc)
    npc.energy = 0.1  # one tick from yielding
    update_combat(state)
    assert npc.combat_target is None  # yielded


def test_npc_dies_below_death_threshold():
    npc = make_npc()
    state = make_state(npc)
    player_attack(state, npc)
    npc.energy = -19.0  # below death threshold
    update_combat(state)
    assert npc.is_dead


def test_player_death_sets_lost():
    npc = make_npc()
    state = make_state(npc)
    player_attack(state, npc)
    state.player.energy = 0.1
    update_combat(state)
    assert state.game_phase == "lost"
