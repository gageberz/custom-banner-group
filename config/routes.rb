# frozen_string_literal: true

CustomGroupBanner::Engine.routes.draw do
  get "/examples" => "examples#index"
  # define routes here
end

Discourse::Application.routes.draw { mount ::CustomGroupBanner::Engine, at: "custom-group-banner" }
