from tests.conftest import make_npc, make_state
from shogun.systems.social import player_befriend, can_befriend, nearest_npc
from shogun.core.constants import NpcClass, NPC_CLASS_DATA


def test_befriend_succeeds_when_energy_low():
    npc = make_npc(npc_class=NpcClass.BANDIT)
    state = make_state(npc)
    threshold = NPC_CLASS_DATA[NpcClass.BANDIT]["befriend_pct"]
    npc.energy = npc.max_energy * (threshold / 100) * 0.9  # below threshold
    msg = player_befriend(state, npc)
    assert npc.is_follower
    assert npc.id in state.player.follower_ids


def test_befriend_fails_when_energy_high():
    npc = make_npc(npc_class=NpcClass.BANDIT)
    state = make_state(npc)
    npc.energy = npc.max_energy  # full energy
    msg = player_befriend(state, npc)
    assert not npc.is_follower
    assert "not yet willing" in msg


def test_bribed_npc_can_be_befriended():
    npc = make_npc(npc_class=NpcClass.LORD)
    state = make_state(npc)
    npc.energy = npc.max_energy  # would normally refuse
    npc.bribed_until_tick = state.elapsed_ticks + 100
    assert can_befriend(state, npc)


def test_already_follower_cannot_be_befriended_again():
    npc = make_npc()
    npc.is_follower = True
    state = make_state(npc)
    msg = player_befriend(state, npc)
    assert "already" in msg


def test_nearest_npc_within_range():
    npc = make_npc()
    state = make_state(npc)
    state.player.position = (400.0, 300.0)
    npc.position = (410.0, 300.0)  # within CONTACT_DISTANCE
    result = nearest_npc(state)
    assert result is npc


def test_nearest_npc_out_of_range():
    npc = make_npc()
    state = make_state(npc)
    state.player.position = (100.0, 100.0)
    npc.position = (900.0, 700.0)  # far away
    result = nearest_npc(state)
    assert result is None
