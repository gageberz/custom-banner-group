# frozen_string_literal: true

class CreateBannerDismissals < ActiveRecord::Migration[6.1]
  def up
    create_table :banner_dismissals do |t|
      t.integer :user_id, null: false
      t.string :banner_key, null: false
      t.timestamps null: false
    end

    add_index :banner_dismissals, [:user_id, :banner_key], unique: true
    add_index :banner_dismissals, :user_id
  end

  def down
    drop_table :banner_dismissals
  end
end