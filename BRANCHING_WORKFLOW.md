# Branching workflow (main + vm-deploy)

## Princip

- **`main` je source of truth za kod** (`backend/`, `frontend/`).
- **`vm-deploy` je deployment packaging za VM** (VM compose fajlovi + VM env + isti kod).
- Kod promjene se rade na `main`, pa se prenesu na `vm-deploy` merge-om `main -> vm-deploy`.

## A) Kod promjene (treba i host i VM)

### 1) Radi na `main`

```bash
git checkout main
git pull

# izmjene...
git add -A
git commit -m "feat(scope): ..."  # ili fix/chore/refactor...
git push
```

### 2) Prenesi na `vm-deploy`

```bash
git checkout vm-deploy
git pull
git merge main
git push
```

## B) VM-only promjene (samo VM compose / VM env / VM runbook)

Radi direktno na `vm-deploy`:

```bash
git checkout vm-deploy
git pull

# izmjene...
git add -A
git commit -m "chore(vm): ..."
git push
```

Ne merge-ati ove commit-e nazad na `main` (da `main` ne “povuče” VM-only packaging).

## C) Host-only promjene (npr. `.github/workflows/deploy.yml`, `docker-compose.yml`)

Radi na `main`:

```bash
git checkout main
git pull

# izmjene...
git add -A
git commit -m "chore(deploy): ..."
git push
```

Ne prenosi na `vm-deploy` (VM grana nema `.github/` ni host compose).

## D) Ako si greškom radio na pogrešnoj grani

- **Kod promjene napravljene na `vm-deploy` koje trebaju i na `main`**:
  - prebaci samo relevantne commit-e na `main` preko `git cherry-pick <hash>`,
  - ne cherry-pickati VM cleanup/packaging commit-e na `main`.

## Brza provjera “gdje sam”

```bash
git status -sb
git branch --show-current
```

