"""initial_migration

Revision ID: 89cb1974346f
Revises:
Create Date: 2026-10-06 11:22:38.726549

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '89cb1974346f'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.Text(), nullable=False),
        sa.Column('hashed_password', sa.Text(), nullable=False),
        sa.Column('display_name', sa.Text(), nullable=False, server_default=''),
        sa.Column('avatar_url', sa.Text(), nullable=True),
        sa.Column('country', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    # Sessions table
    op.create_table(
        'sessions',
        sa.Column('id', PG_UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('device', sa.Text(), nullable=True),
        sa.Column('ip', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sessions_user_id', 'sessions', ['user_id'])

    # User Settings table
    op.create_table(
        'user_settings',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('data', JSON().with_variant(JSONB, 'postgresql'), nullable=False, server_default='{}'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id'),
    )

    # Playlists table
    op.create_table(
        'playlists',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_playlists_user_id', 'playlists', ['user_id'])

    # Playlist Tracks table
    op.create_table(
        'playlist_tracks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('playlist_id', sa.Integer(), nullable=False),
        sa.Column('yt_id', sa.Text(), nullable=False),
        sa.Column('title', sa.Text(), nullable=False),
        sa.Column('artist', sa.Text(), nullable=False),
        sa.Column('album', sa.Text(), nullable=True),
        sa.Column('duration', sa.Integer(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['playlist_id'], ['playlists.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_playlist_tracks_playlist_id', 'playlist_tracks', ['playlist_id'])
    op.create_index('ix_playlist_tracks_yt_id', 'playlist_tracks', ['yt_id'])

    # Liked Tracks table
    op.create_table(
        'liked_tracks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('yt_id', sa.Text(), nullable=False),
        sa.Column('title', sa.Text(), nullable=False),
        sa.Column('artist', sa.Text(), nullable=False),
        sa.Column('album', sa.Text(), nullable=True),
        sa.Column('duration', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'yt_id', name='uq_user_yt_id'),
    )
    op.create_index('ix_liked_tracks_user_id', 'liked_tracks', ['user_id'])
    op.create_index('ix_liked_tracks_yt_id', 'liked_tracks', ['yt_id'])

    # Play Events table
    op.create_table(
        'play_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('yt_id', sa.Text(), nullable=False),
        sa.Column('title', sa.Text(), nullable=False),
        sa.Column('artist', sa.Text(), nullable=False),
        sa.Column('played_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_play_events_user_id', 'play_events', ['user_id'])
    op.create_index('ix_play_events_yt_id', 'play_events', ['yt_id'])
    op.create_index('ix_play_events_played_at', 'play_events', ['played_at'])
    op.create_index('ix_play_events_user_played_at', 'play_events', ['user_id', 'played_at'])

    # Search Cache table
    op.create_table(
        'search_cache',
        sa.Column('key', sa.Text(), nullable=False),
        sa.Column('payload', JSON().with_variant(JSONB, 'postgresql'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('key'),
    )
    op.create_index('ix_search_cache_expires_at', 'search_cache', ['expires_at'])

    # Password Reset Tokens table
    op.create_table(
        'password_reset_tokens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token_hash', sa.Text(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_password_reset_tokens_user_id', 'password_reset_tokens', ['user_id'])
    op.create_index('ix_password_reset_tokens_expires_at', 'password_reset_tokens', ['expires_at'])


def downgrade() -> None:
    op.drop_index('ix_password_reset_tokens_expires_at', table_name='password_reset_tokens')
    op.drop_index('ix_password_reset_tokens_user_id', table_name='password_reset_tokens')
    op.drop_table('password_reset_tokens')

    op.drop_index('ix_search_cache_expires_at', table_name='search_cache')
    op.drop_table('search_cache')

    op.drop_index('ix_play_events_user_played_at', table_name='play_events')
    op.drop_index('ix_play_events_played_at', table_name='play_events')
    op.drop_index('ix_play_events_yt_id', table_name='play_events')
    op.drop_index('ix_play_events_user_id', table_name='play_events')
    op.drop_table('play_events')

    op.drop_index('ix_liked_tracks_yt_id', table_name='liked_tracks')
    op.drop_index('ix_liked_tracks_user_id', table_name='liked_tracks')
    op.drop_table('liked_tracks')

    op.drop_index('ix_playlist_tracks_yt_id', table_name='playlist_tracks')
    op.drop_index('ix_playlist_tracks_playlist_id', table_name='playlist_tracks')
    op.drop_table('playlist_tracks')

    op.drop_index('ix_playlists_user_id', table_name='playlists')
    op.drop_table('playlists')

    op.drop_table('user_settings')

    op.drop_index('ix_sessions_user_id', table_name='sessions')
    op.drop_table('sessions')

    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')