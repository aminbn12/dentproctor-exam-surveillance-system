"""Add subjects field to professors

Revision ID: 0001_add_subjects
Revises: 0affe9a8d3b4
Create Date: 2026-06-16 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0001_add_subjects'
down_revision: Union[str, None] = '0affe9a8d3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ajouter le champ subjects à la table professors
    op.add_column('professors', sa.Column('subjects', sa.JSON(), nullable=False, server_default='[]'))


def downgrade() -> None:
    # Supprimer le champ subjects
    op.drop_column('professors', 'subjects')
