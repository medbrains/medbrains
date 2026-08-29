# Repo-root convenience wrapper.
#
# Every target lives in `medbrains/Makefile`. This file exists so that `make
# <anything>` works from the repository root as well as from `medbrains/`.
#
# It used to forward 71 targets by hand, out of the 176 the real Makefile
# defines, and duplicated every variable default alongside them. The 105 it did
# not list simply did not exist at the root — `make dev-pf-setup` answered "No
# rule to make target", which reads like the target is gone rather than like
# you are standing in the wrong directory. `authz-ledger`, `check-permissions`,
# `check-sql-prepare` and a hundred others were unreachable the same way.
#
# A façade that covers part of an interface is worse than no façade: you cannot
# tell from outside which part. So it forwards everything instead, and cannot
# fall out of step again as targets are added.
#
# Directory confusion has already cost this repository once — CI was pointed at
# the wrong directory and silently never ran from June onwards.

ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))medbrains

# Variables set on the command line propagate to sub-makes on their own, so
# `make dev DEV_HTTPS_DOMAIN=example.localhost` still works. Defaults are not
# repeated here: `medbrains/Makefile` declares all of them with `?=`, and a
# second copy at the root is a second thing to keep in step.

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show the real Makefile's help
	@$(MAKE) --no-print-directory -C $(ROOT) help

# Anything with no rule here is a target of the real Makefile.
.DEFAULT:
	@$(MAKE) --no-print-directory -C $(ROOT) $@

# Never try to rebuild this file through the rule above.
Makefile: ;
