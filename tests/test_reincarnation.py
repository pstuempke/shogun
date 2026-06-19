from tests.conftest import make_npc, make_state
from shogun.systems.reincarnation import begin_death, update_reincarnation
from shogun.core.constants import RESPAWN_DELAY, NpcClass


def test_begin_death_marks_npc_dead():
    npc = make_npc()
    state = make_state(npc)
    begin_death(state, npc)
    assert npc.is_dead
    assert npc.death_tick == 0
    assert not npc.is_follower


def test_follower_removed_on_death():
    npc = make_npc()
    state = make_state(npc)
    npc.is_follower = True
    state.player.follower_ids.append(npc.id)
    begin_death(state, npc)
    assert npc.id not in state.player.follower_ids


def test_npc_does_not_respawn_too_early():
    npc = make_npc()
    state = make_state(npc)
    begin_death(state, npc)
    state.elapsed_ticks = RESPAWN_DELAY - 1
    update_reincarnation(state)
    assert npc.is_dead


def test_npc_respawns_after_delay():
    npc = make_npc()
    state = make_state(npc)
    begin_death(state, npc)
    state.elapsed_ticks = RESPAWN_DELAY
    update_reincarnation(state)
    assert not npc.is_dead
    assert npc.energy == npc.max_energy


def test_respawn_may_change_class():
    results = set()
    for _ in range(200):
        npc = make_npc(npc_class=NpcClass.BANDIT)
        state = make_state(npc)
        begin_death(state, npc)
        state.elapsed_ticks = RESPAWN_DELAY
        update_reincarnation(state)
        results.add(npc.npc_class)
    # over 200 trials we should see more than one class
    assert len(results) > 1
